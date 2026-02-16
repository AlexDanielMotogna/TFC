/**
 * Fill Detector Module
 *
 * Detects when limit/stop orders placed during fights get filled on Pacifica.
 * Runs every 5 seconds from the fight engine tick loop.
 *
 * Architecture:
 * 1. Query TfcOrderAction for pending LIMIT_ORDER/CREATE_STOP with pacificaOrderId
 * 2. Fetch Pacifica trade history for participants with pending orders
 * 3. Match fills by order_id
 * 4. POST to /api/internal/record-fill (web app) to reuse all existing trade recording logic
 *
 * Deduplication (3 layers):
 * - In-memory processedHistoryIds set
 * - FightTrade table check before calling API
 * - Trade table @@unique([pacificaHistoryId]) constraint
 *
 * @see Fight.md - Fill Detector architecture
 */

import { prisma, Prisma } from '@tfc/db';
import { createLogger } from '@tfc/logger';
import { LOG_EVENTS } from '@tfc/shared';
import { getTradeHistory, type TradeHistoryEntry } from './pacifica-client.js';

const WEB_API_URL = process.env.WEB_API_URL || 'http://localhost:3001';
const INTERNAL_API_KEY = process.env.INTERNAL_API_KEY || 'dev-internal-key';

const logger = createLogger({ service: 'realtime' });

// Raw SQL result type for pending order actions
interface PendingActionRow {
  id: string;
  user_id: string;
  wallet_address: string;
  fight_id: string | null;
  symbol: string;
  side: string | null;
  pacifica_order_id: bigint | null;
  leverage: number | null;
  action_type: string;
}

export class FillDetector {
  // In-memory dedup: track history IDs we've already processed
  private processedHistoryIds = new Set<string>();

  // Track which fights+users we're currently processing (prevent concurrent checks)
  private processingKeys = new Set<string>();

  /**
   * Check for filled orders across all live fights
   * Called every 5 seconds from the fight engine tick loop
   */
  async checkForFilledOrders(liveFights: Array<{ id: string; startedAt: Date | null; durationMinutes: number }>): Promise<void> {
    try {
      // Get all pending order actions for live fights
      const liveFightIds = liveFights.map(f => f.id);
      if (liveFightIds.length === 0) return;

      // Use raw SQL with TEXT cast to avoid PostgreSQL enum type mismatch
      // (CREATE_STOP may not be in the DB enum yet if migration hasn't run)
      const pendingActions = await prisma.$queryRaw<PendingActionRow[]>`
        SELECT id, user_id, wallet_address, fight_id, symbol, side,
               pacifica_order_id, leverage, action_type::text as action_type
        FROM tfc_order_actions
        WHERE fight_id IN (${Prisma.join(liveFightIds)})
          AND action_type::text IN ('LIMIT_ORDER', 'CREATE_STOP', 'SET_TPSL')
          AND pacifica_order_id IS NOT NULL
          AND success = true
      `;

      if (pendingActions.length === 0) return;

      // Normalize raw SQL rows to camelCase for downstream use
      const normalizedActions = pendingActions.map(row => ({
        id: row.id,
        userId: row.user_id,
        walletAddress: row.wallet_address,
        fightId: row.fight_id,
        symbol: row.symbol,
        side: row.side,
        pacificaOrderId: row.pacifica_order_id,
        leverage: row.leverage,
        actionType: row.action_type,
      }));

      // Group by user+fight to batch API calls
      const userFightGroups = new Map<string, {
        userId: string;
        walletAddress: string;
        fightId: string;
        fight: { startedAt: Date | null; durationMinutes: number };
        actions: typeof normalizedActions;
      }>();

      for (const action of normalizedActions) {
        if (!action.fightId) continue;
        const key = `${action.userId}:${action.fightId}`;

        if (!userFightGroups.has(key)) {
          const fight = liveFights.find(f => f.id === action.fightId);
          if (!fight) continue;

          userFightGroups.set(key, {
            userId: action.userId,
            walletAddress: action.walletAddress,
            fightId: action.fightId,
            fight,
            actions: [],
          });
        }

        userFightGroups.get(key)!.actions.push(action);
      }

      // Process each user+fight group
      const promises: Promise<void>[] = [];
      for (const [key, group] of userFightGroups) {
        // Skip if already processing
        if (this.processingKeys.has(key)) continue;
        this.processingKeys.add(key);

        promises.push(
          this.checkUserFills(group).finally(() => {
            this.processingKeys.delete(key);
          })
        );
      }

      await Promise.allSettled(promises);
    } catch (error) {
      logger.error(LOG_EVENTS.API_ERROR, 'Fill detection failed', error as Error);
    }
  }

  /**
   * Check for fills for a specific user in a specific fight
   */
  private async checkUserFills(group: {
    userId: string;
    walletAddress: string;
    fightId: string;
    fight: { startedAt: Date | null; durationMinutes: number };
    actions: Array<{
      id: string;
      pacificaOrderId: bigint | null;
      symbol: string;
      side: string | null;
      leverage: number | null;
      actionType: string;
    }>;
  }): Promise<void> {
    try {
      const { userId, walletAddress, fightId, fight, actions } = group;

      if (!fight.startedAt) return;

      // Get account address from wallet address -> PacificaConnection
      const connection = await prisma.pacificaConnection.findFirst({
        where: { userId },
        select: { accountAddress: true },
      });

      if (!connection) return;

      // Fetch trade history from Pacifica for this user
      // Use fight start time to limit the query window
      const fightStartSeconds = Math.floor(fight.startedAt.getTime() / 1000);
      const trades = await getTradeHistory({
        accountAddress: connection.accountAddress,
        startTime: fightStartSeconds,
        limit: 50,
      });

      if (trades.length === 0) return;

      // Build lookup of pending order IDs
      const actionsByOrderId = new Map<string, typeof actions[0]>();
      for (const action of actions) {
        if (action.pacificaOrderId) {
          actionsByOrderId.set(action.pacificaOrderId.toString(), action);
        }
      }

      // Match fills to pending orders
      for (const trade of trades) {
        const historyKey = `${fightId}:${trade.history_id}`;

        // Layer 1: In-memory dedup
        if (this.processedHistoryIds.has(historyKey)) continue;

        // Match by order_id
        const matchedAction = actionsByOrderId.get(trade.order_id.toString());
        if (!matchedAction) {
          // Check if this is a TP/SL fill (cause contains "stop_loss" or "take_profit")
          if (!this.isTpSlFill(trade)) continue;

          // For TP/SL fills, try matching by symbol from SET_TPSL actions
          const tpslAction = actions.find(a =>
            a.actionType === 'SET_TPSL' &&
            a.symbol === trade.symbol
          );
          if (!tpslAction) continue;

          // Use the TP/SL action's leverage (or null)
          await this.recordFill(connection.accountAddress, trade, fightId, tpslAction.leverage, historyKey);
          continue;
        }

        // Layer 2: DB dedup - check if FightTrade already exists
        const existingFightTrade = await prisma.fightTrade.findUnique({
          where: {
            fightId_pacificaHistoryId: {
              fightId,
              pacificaHistoryId: BigInt(trade.history_id),
            },
          },
          select: { id: true },
        });

        if (existingFightTrade) {
          this.processedHistoryIds.add(historyKey);
          continue;
        }

        await this.recordFill(connection.accountAddress, trade, fightId, matchedAction.leverage, historyKey);
      }
    } catch (error) {
      logger.error(LOG_EVENTS.API_ERROR, 'Failed to check fills for user', error as Error, {
        userId: group.userId,
        fightId: group.fightId,
      });
    }
  }

  /**
   * Record a detected fill via the internal API
   */
  private async recordFill(
    accountAddress: string,
    trade: TradeHistoryEntry,
    fightId: string,
    leverage: number | null,
    historyKey: string
  ): Promise<void> {
    try {
      logger.info(LOG_EVENTS.FIGHT_ACTIVITY, 'Fill detected', {
        fightId,
        accountAddress,
        symbol: trade.symbol,
        side: trade.side,
        amount: trade.amount,
        price: trade.price,
        orderId: trade.order_id,
        historyId: trade.history_id,
      });

      // Determine side for TFC recording
      // Pacifica trade.side can be: open_long, open_short, close_long, close_short
      const side = (trade.side === 'open_long' || trade.side === 'close_short') ? 'bid' : 'ask';

      const response = await fetch(`${WEB_API_URL}/api/internal/record-fill`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Internal-Key': INTERNAL_API_KEY,
        },
        body: JSON.stringify({
          accountAddress,
          symbol: trade.symbol,
          side,
          amount: trade.amount,
          orderId: trade.order_id,
          historyId: trade.history_id.toString(),
          executionPrice: trade.price,
          fee: trade.fee || '0',
          pnl: trade.pnl || null,
          fightId,
          leverage,
        }),
      });

      if (response.ok) {
        this.processedHistoryIds.add(historyKey);
        logger.info(LOG_EVENTS.FIGHT_ACTIVITY, 'Fill recorded successfully', {
          fightId,
          historyId: trade.history_id,
          symbol: trade.symbol,
        });
      } else {
        const error = await response.text();
        logger.error(LOG_EVENTS.API_ERROR, 'Failed to record fill via API', {
          fightId,
          historyId: trade.history_id,
          status: response.status,
          error,
        });
      }
    } catch (error) {
      logger.error(LOG_EVENTS.API_ERROR, 'Failed to record fill', error as Error, {
        fightId,
        historyId: trade.history_id,
      });
    }
  }

  /**
   * Check if a trade is a TP/SL fill based on its cause
   */
  private isTpSlFill(trade: TradeHistoryEntry): boolean {
    if (!trade.cause) return false;
    const cause = trade.cause.toLowerCase();
    return cause.includes('stop_loss') || cause.includes('take_profit');
  }

  /**
   * Clear processed history for a fight (called when fight ends)
   */
  clearFight(fightId: string): void {
    // Remove entries for this fight from the processed set
    const keysToRemove: string[] = [];
    for (const key of this.processedHistoryIds) {
      if (key.startsWith(`${fightId}:`)) {
        keysToRemove.push(key);
      }
    }
    for (const key of keysToRemove) {
      this.processedHistoryIds.delete(key);
    }
  }
}
