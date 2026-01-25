import { Server } from 'socket.io';
import { prisma, FightStatus, Fight, FightParticipant, User } from '@tfc/db';
import { createLogger } from '@tfc/logger';
import { LOG_EVENTS, WS_EVENTS, PNL_TICK_INTERVAL_MS, type ArenaPnlTickPayload, type PlatformStatsPayload } from '@tfc/shared';
import { getPrices, getTradeHistory, MarketPrice } from './pacifica-client.js';

// External trades check interval (every 30 seconds)
const EXTERNAL_TRADES_CHECK_INTERVAL = 30;

// Anti-cheat API configuration
const WEB_API_URL = process.env.WEB_API_URL || 'http://localhost:3000';
const INTERNAL_API_KEY = process.env.INTERNAL_API_KEY || 'dev-internal-key';

// Snapshot save interval (every 5 seconds to reduce DB load)
// A 5-minute fight = 60 snapshots instead of 300
const SNAPSHOT_SAVE_INTERVAL = 5;

// Snapshot cleanup interval (every hour)
const SNAPSHOT_CLEANUP_INTERVAL_MS = 60 * 60 * 1000;

// Snapshot retention period (30 days)
const SNAPSHOT_RETENTION_DAYS = 30;

// Max leverage per symbol (from Pacifica settings)
// Used to calculate margin for ROI% calculation
const MAX_LEVERAGE: Record<string, number> = {
  'BTC-USD': 50, 'ETH-USD': 50, 'SOL-USD': 20, 'HYPE-USD': 20, 'XRP-USD': 20,
  'DOGE-USD': 20, 'LINK-USD': 20, 'AVAX-USD': 20, 'SUI-USD': 10, 'BNB-USD': 10,
  'AAVE-USD': 10, 'ARB-USD': 10, 'OP-USD': 10, 'APT-USD': 10, 'INJ-USD': 10,
  'TIA-USD': 10, 'SEI-USD': 10, 'WIF-USD': 10, 'JUP-USD': 10, 'PENDLE-USD': 10,
  'RENDER-USD': 10, 'FET-USD': 10, 'ZEC-USD': 10, 'PAXG-USD': 10, 'ENA-USD': 10,
  'KPEPE-USD': 10,
};

// Type for Fight with participants and users
type FightWithParticipants = Fight & {
  participants: (FightParticipant & { user: User })[];
  creator?: User | null;
};

const logger = createLogger({ service: 'realtime' });

/**
 * Calculate unrealized PnL for a specific fight from FightTrade records
 * This ensures each fight has independent PnL tracking
 *
 * Formula:
 * - For each symbol: Calculate net position from BUY/SELL trades
 * - Unrealized PnL = (markPrice - avgEntryPrice) * netAmount
 *
 * @param fightId - The specific fight to calculate PnL for
 * @param userId - The user's ID
 * @param cachedPrices - Optional cached prices to avoid repeated API calls
 */
async function calculateUnrealizedPnlFromFightTrades(
  fightId: string,
  userId: string,
  cachedPrices?: MarketPrice[]
): Promise<{ unrealizedPnl: number; funding: number; totalPositionValue: number; margin: number; realizedPnl: number; fees: number; tradesCount: number }> {
  try {
    const [fightTrades, prices] = await Promise.all([
      prisma.fightTrade.findMany({
        where: { fightId, participantUserId: userId },
        orderBy: { executedAt: 'asc' }, // Process in chronological order
      }),
      cachedPrices ? Promise.resolve(cachedPrices) : getPrices(),
    ]);

    // Calculate net position per symbol from fight trades
    // Also track leverage used for each symbol (use the first trade's leverage)
    const positionsBySymbol: Record<string, { amount: number; totalCost: number; leverage: number | null }> = {};

    // Per Fight-Engine_Rules.md Rules 18-21:
    // Only CLOSED positions count for PnL - opening trades don't contribute
    // We track realizedPnl by only counting pnl from CLOSING trades
    let realizedPnl = 0;
    let totalFees = 0;
    // Note: Platform fee (0.05%) is already included in Pacifica's fee field via Builder Code
    // No need to calculate separately - Pacifica combines base fee + builder fee

    for (const trade of fightTrades) {
      const symbol = trade.symbol;
      const amount = parseFloat(trade.amount.toString());
      const price = parseFloat(trade.price.toString());
      const tradeLeverage = trade.leverage;
      const tradePnl = trade.pnl ? Number(trade.pnl) : 0;
      const tradeFee = Number(trade.fee);

      totalFees += tradeFee;
      // Note: closingNotional is tracked below only for closing trades

      if (!positionsBySymbol[symbol]) {
        positionsBySymbol[symbol] = { amount: 0, totalCost: 0, leverage: tradeLeverage };
      }

      // Update leverage if this trade has one (use the most recent trade's leverage for opening positions)
      if (tradeLeverage) {
        positionsBySymbol[symbol].leverage = tradeLeverage;
      }

      if (trade.side === 'BUY') {
        // BUY increases LONG position or closes SHORT
        if (positionsBySymbol[symbol].amount < 0) {
          // CLOSING SHORT position - this pnl counts!
          const absShort = Math.abs(positionsBySymbol[symbol].amount);
          const closeAmount = Math.min(amount, absShort);
          const openAmount = amount - closeAmount;

          // Only count pnl proportionally if partially closing
          if (closeAmount > 0) {
            const pnlPortion = closeAmount / amount;
            realizedPnl += tradePnl * pnlPortion;
          }

          // Reduce SHORT proportionally
          if (absShort > 0) {
            const avgShortEntry = positionsBySymbol[symbol].totalCost / absShort;
            positionsBySymbol[symbol].totalCost -= closeAmount * avgShortEntry;
          }
          positionsBySymbol[symbol].amount += closeAmount;

          // Any remaining opens a new LONG (this portion's pnl doesn't count)
          if (openAmount > 0) {
            positionsBySymbol[symbol].totalCost += openAmount * price;
            positionsBySymbol[symbol].amount += openAmount;
          }
        } else {
          // OPENING/increasing LONG position - pnl doesn't count per Rules 18-21
          positionsBySymbol[symbol].totalCost += amount * price;
          positionsBySymbol[symbol].amount += amount;
        }
      } else {
        // SELL increases SHORT position or closes LONG
        if (positionsBySymbol[symbol].amount > 0) {
          // CLOSING LONG position - this pnl counts!
          const closeAmount = Math.min(amount, positionsBySymbol[symbol].amount);
          const openAmount = amount - closeAmount;

          // Only count pnl proportionally if partially closing
          if (closeAmount > 0) {
            const pnlPortion = closeAmount / amount;
            realizedPnl += tradePnl * pnlPortion;
          }

          // Reduce LONG proportionally
          const avgLongEntry = positionsBySymbol[symbol].totalCost / positionsBySymbol[symbol].amount;
          positionsBySymbol[symbol].totalCost -= closeAmount * avgLongEntry;
          positionsBySymbol[symbol].amount -= closeAmount;

          // Any remaining opens a new SHORT (this portion's pnl doesn't count)
          if (openAmount > 0) {
            positionsBySymbol[symbol].totalCost += openAmount * price;
            positionsBySymbol[symbol].amount -= openAmount;
          }
        } else {
          // OPENING/increasing SHORT position - pnl doesn't count per Rules 18-21
          positionsBySymbol[symbol].totalCost += amount * price;
          positionsBySymbol[symbol].amount -= amount;
        }
      }
    }

    // Calculate unrealized PnL, position values, and margin for open positions
    let unrealizedPnl = 0;
    let totalPositionValue = 0;
    let totalMargin = 0;

    for (const [symbol, pos] of Object.entries(positionsBySymbol)) {
      // Skip if no position
      if (Math.abs(pos.amount) < 0.0000001) {
        continue;
      }

      const price = prices.find((p) => p.symbol === symbol);
      if (!price) continue;

      const markPrice = parseFloat(price.mark);
      // For both LONG and SHORT, totalCost is positive and represents entry_price * |amount|
      // avgEntryPrice should always be positive
      const avgEntryPrice = Math.abs(pos.amount) > 0 ? pos.totalCost / Math.abs(pos.amount) : 0;

      // PnL calculation:
      // LONG (amount > 0): profit when price goes UP -> (markPrice - entry) * amount
      // SHORT (amount < 0): profit when price goes DOWN -> (entry - markPrice) * |amount|
      //                     = (markPrice - entry) * amount (since amount is negative)
      // So the formula works for both: (markPrice - avgEntryPrice) * pos.amount
      unrealizedPnl += (markPrice - avgEntryPrice) * pos.amount;

      // Position value at mark price
      const positionValue = Math.abs(pos.amount) * markPrice;
      totalPositionValue += positionValue;

      // Use leverage from trade if available, otherwise fall back to MAX_LEVERAGE
      const leverage = pos.leverage || MAX_LEVERAGE[symbol] || 10;
      const margin = positionValue / leverage;
      totalMargin += margin;
    }

    // Note: Funding is tracked per-position on Pacifica, not per-fight
    // For fight-specific calculations, we don't include funding

    // Note: Platform fee (0.05%) is already included in Pacifica's fee via Builder Code
    // Pacifica combines base fee + builder fee in the trade.fee field
    // So totalFees already includes our platform fee - no separate calculation needed

    return {
      unrealizedPnl,
      funding: 0,
      totalPositionValue,
      margin: totalMargin,
      realizedPnl,
      fees: totalFees,
      tradesCount: fightTrades.length,
    };
  } catch (error) {
    logger.error(LOG_EVENTS.API_ERROR, 'Failed to calculate unrealized PnL from fight trades', error as Error, {
      fightId,
      userId,
    });
    return { unrealizedPnl: 0, funding: 0, totalPositionValue: 0, margin: 0, realizedPnl: 0, fees: 0, tradesCount: 0 };
  }
}

/**
 * Detect trades made outside TradeFightClub during a fight
 * Compares Pacifica trade history with our FightTrade records
 *
 * @param fightId - The fight ID
 * @param userId - The user ID
 * @param accountAddress - The user's Pacifica account address
 * @param fightStart - Fight start timestamp
 * @param fightEnd - Fight end timestamp (or now if still live)
 * @returns Object with detected flag and list of external trade IDs
 */
async function detectExternalTrades(
  fightId: string,
  userId: string,
  accountAddress: string,
  fightStart: Date,
  fightEnd: Date
): Promise<{ detected: boolean; externalTradeIds: string[] }> {
  try {
    const startTime = Math.floor(fightStart.getTime() / 1000);
    const endTime = Math.floor(fightEnd.getTime() / 1000);

    logger.info(LOG_EVENTS.FIGHT_ACTIVITY, 'Checking for external trades', {
      fightId,
      userId,
      accountAddress,
      startTime,
      endTime,
      startTimeDate: fightStart.toISOString(),
      endTimeDate: fightEnd.toISOString(),
    });

    // 1. Get all trades from Pacifica in the fight time window
    const pacificaTrades = await getTradeHistory({
      accountAddress,
      startTime,
      endTime,
      limit: 100,
    });

    logger.info(LOG_EVENTS.FIGHT_ACTIVITY, 'Pacifica trades fetched', {
      fightId,
      userId,
      pacificaTradesCount: pacificaTrades.length,
      pacificaTradeIds: pacificaTrades.map((t) => t.history_id),
    });

    // 2. Get the pacificaHistoryIds registered in our DB for this fight
    const fightTrades = await prisma.fightTrade.findMany({
      where: { fightId, participantUserId: userId },
      select: { pacificaHistoryId: true },
    });

    // Convert BigInt to string for comparison (BigInt.toString() returns decimal string)
    const registeredIds = new Set(
      fightTrades.map((t) => String(t.pacificaHistoryId))
    );

    logger.info(LOG_EVENTS.FIGHT_ACTIVITY, 'DB fight trades fetched', {
      fightId,
      userId,
      dbTradesCount: fightTrades.length,
      registeredIds: Array.from(registeredIds),
    });

    // 3. Find trades from Pacifica that are NOT in our DB
    // Convert history_id to string for consistent comparison
    const externalTrades = pacificaTrades.filter(
      (t) => !registeredIds.has(String(t.history_id))
    );

    if (externalTrades.length > 0) {
      logger.warn(LOG_EVENTS.API_ERROR, 'External trades detected', {
        fightId,
        userId,
        count: externalTrades.length,
        tradeIds: externalTrades.map((t) => t.history_id.toString()),
      });
    } else {
      logger.info(LOG_EVENTS.FIGHT_ACTIVITY, 'No external trades detected', {
        fightId,
        userId,
      });
    }

    return {
      detected: externalTrades.length > 0,
      externalTradeIds: externalTrades.map((t) => t.history_id.toString()),
    };
  } catch (error) {
    logger.error(LOG_EVENTS.API_ERROR, 'Failed to detect external trades', error as Error, {
      fightId,
      userId,
    });
    return { detected: false, externalTradeIds: [] };
  }
}

export interface FightState {
  fightId: string;
  status: FightStatus;
  durationMinutes: number;
  stakeUsdc: number;
  startedAt: Date | null;
  endsAt: Date | null;
  participantA: ParticipantState | null;
  participantB: ParticipantState | null;
  leader: string | null;
  timeRemainingMs: number;
}

export interface ParticipantState {
  userId: string;
  handle: string;
  slot: 'A' | 'B';
  pnlPercent: number;
  scoreUsdc: number;
  tradesCount: number;
  realizedPnl: number;
  unrealizedPnl: number;
  fees: number;
  funding: number;
  positionValue: number;
  margin: number;
}

// Warning threshold: 30 seconds before fight ends (per Rules 30-32)
const FIGHT_ENDING_WARNING_MS = 30000;

export class FightEngine {
  private io: Server;
  private activeFights: Map<string, FightState> = new Map();
  private fightWarningsSent: Set<string> = new Set(); // Track fights that have received 30-second warning
  private tickInterval: NodeJS.Timeout | null = null;
  private cleanupInterval: NodeJS.Timeout | null = null;
  private tickCount: number = 0;

  constructor(io: Server) {
    this.io = io;
  }

  /**
   * Start the PnL tick loop
   * Emits PNL_TICK every second for all active fights
   */
  startTickLoop() {
    logger.info(LOG_EVENTS.SCORING_RECALC_SUCCESS, 'Starting fight engine tick loop');

    this.tickInterval = setInterval(async () => {
      await this.processTick();
    }, PNL_TICK_INTERVAL_MS);
  }

  stopTickLoop() {
    if (this.tickInterval) {
      clearInterval(this.tickInterval);
      this.tickInterval = null;
    }
  }

  /**
   * Start the snapshot cleanup loop
   * Runs every hour to delete old snapshots (> 30 days)
   */
  startCleanupLoop() {
    logger.info(LOG_EVENTS.SCORING_RECALC_SUCCESS, 'Starting snapshot cleanup loop (runs every hour)');

    // Run immediately on startup
    this.cleanupOldSnapshots().catch((err) => {
      logger.error(LOG_EVENTS.API_ERROR, 'Initial snapshot cleanup failed', err as Error);
    });

    // Then run every hour
    this.cleanupInterval = setInterval(async () => {
      await this.cleanupOldSnapshots();
    }, SNAPSHOT_CLEANUP_INTERVAL_MS);
  }

  stopCleanupLoop() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }

  /**
   * Delete snapshots older than SNAPSHOT_RETENTION_DAYS
   * This keeps the database size manageable
   */
  async cleanupOldSnapshots(): Promise<{ deleted: number }> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - SNAPSHOT_RETENTION_DAYS);

      const result = await prisma.fightSnapshot.deleteMany({
        where: {
          timestamp: {
            lt: cutoffDate,
          },
        },
      });

      if (result.count > 0) {
        logger.info(LOG_EVENTS.SCORING_SNAPSHOT_WRITE, 'Old snapshots cleaned up', {
          deletedCount: result.count,
          cutoffDate: cutoffDate.toISOString(),
          retentionDays: SNAPSHOT_RETENTION_DAYS,
        });
      }

      return { deleted: result.count };
    } catch (error) {
      logger.error(LOG_EVENTS.API_ERROR, 'Failed to cleanup old snapshots', error as Error);
      return { deleted: 0 };
    }
  }

  /**
   * Process a single tick for all active fights
   */
  private async processTick() {
    this.tickCount++;

    // Load active LIVE fights from database
    const liveFights = await prisma.fight.findMany({
      where: { status: FightStatus.LIVE },
      include: {
        participants: {
          include: {
            user: true,
          },
        },
      },
    });

    // Check for external trades every 30 seconds
    const shouldCheckExternalTrades = this.tickCount % EXTERNAL_TRADES_CHECK_INTERVAL === 0;

    // Save snapshots every 5 seconds (not every tick to reduce DB load)
    const shouldSaveSnapshot = this.tickCount % SNAPSHOT_SAVE_INTERVAL === 0;

    if (shouldCheckExternalTrades) {
      logger.info(LOG_EVENTS.FIGHT_ACTIVITY, 'External trades check triggered', {
        tickCount: this.tickCount,
        liveFightsCount: liveFights.length,
      });
    }

    // Collect arena PnL data for all live fights
    const arenaPnlData: ArenaPnlTickPayload['fights'] = [];

    for (const fight of liveFights) {
      try {
        // Check for external trades periodically
        if (shouldCheckExternalTrades && fight.startedAt) {
          await this.checkExternalTrades(fight);
        }

        const state = await this.calculateFightState(fight);

        if (state) {
          // Update local cache
          this.activeFights.set(fight.id, state);

          // Save snapshot to database for historical tracking (every 5 seconds, non-blocking)
          if (shouldSaveSnapshot && state.participantA && state.participantB) {
            // Fire-and-forget: don't await to avoid slowing down the tick loop
            this.saveSnapshot(state).catch(() => {
              // Error already logged inside saveSnapshot
            });
          }

          // Emit PNL_TICK to all clients in the fight room
          this.io.to(`fight:${fight.id}`).emit(WS_EVENTS.PNL_TICK, {
            fightId: fight.id,
            timestamp: Date.now(),
            participantA: state.participantA
              ? {
                  userId: state.participantA.userId,
                  pnlPercent: state.participantA.pnlPercent,
                  scoreUsdc: state.participantA.scoreUsdc,
                  tradesCount: state.participantA.tradesCount,
                }
              : null,
            participantB: state.participantB
              ? {
                  userId: state.participantB.userId,
                  pnlPercent: state.participantB.pnlPercent,
                  scoreUsdc: state.participantB.scoreUsdc,
                  tradesCount: state.participantB.tradesCount,
                }
              : null,
            leader: state.leader,
            timeRemainingMs: state.timeRemainingMs,
          });

          // Collect data for arena broadcast
          arenaPnlData.push({
            fightId: fight.id,
            participantA: state.participantA
              ? { userId: state.participantA.userId, pnlPercent: state.participantA.pnlPercent }
              : null,
            participantB: state.participantB
              ? { userId: state.participantB.userId, pnlPercent: state.participantB.pnlPercent }
              : null,
            leader: state.leader,
            timeRemainingMs: state.timeRemainingMs,
          });

          // Check if we need to send 30-second warning (per Rules 30-32)
          // Only send once per fight
          if (
            state.timeRemainingMs <= FIGHT_ENDING_WARNING_MS &&
            state.timeRemainingMs > 0 &&
            !this.fightWarningsSent.has(fight.id)
          ) {
            this.fightWarningsSent.add(fight.id);
            const secondsRemaining = Math.ceil(state.timeRemainingMs / 1000);

            this.io.to(`fight:${fight.id}`).emit(WS_EVENTS.FIGHT_ENDING_SOON, {
              fightId: fight.id,
              secondsRemaining,
              message: 'Fight ending soon! Close all positions to lock in your PnL. Open positions will NOT count towards your final score.',
            });

            logger.info(LOG_EVENTS.FIGHT_ACTIVITY, 'Fight ending soon warning sent', {
              fightId: fight.id,
              secondsRemaining,
            });
          }

          // Check if fight should end
          if (state.timeRemainingMs <= 0) {
            await this.endFight(fight.id, state);
          }
        }
      } catch (error) {
        logger.error(
          LOG_EVENTS.SCORING_RECALC_FAILURE,
          'Failed to process tick for fight',
          error as Error,
          { fightId: fight.id }
        );
      }
    }

    // Broadcast aggregated PnL data to arena subscribers
    if (arenaPnlData.length > 0) {
      this.io.to('arena').emit(WS_EVENTS.ARENA_PNL_TICK, {
        fights: arenaPnlData,
        timestamp: Date.now(),
      } as ArenaPnlTickPayload);
    }
  }

  /**
   * Calculate current fight state from database trades and live positions
   * - PnL only counts CLOSED positions (realized PnL)
   * - Opening a position (long/short) doesn't affect the fight PnL
   * - PnL updates only when a position is closed
   *
   * @param fight - The fight data
   */
  private async calculateFightState(fight: {
    id: string;
    status: FightStatus;
    durationMinutes: number;
    stakeUsdc: number;
    startedAt: Date | null;
    participants: Array<{
      userId: string;
      slot: string;
      maxExposureUsed: any; // Decimal from Prisma
      user: { id: string; handle: string };
    }>;
  }): Promise<FightState | null> {
    if (!fight.startedAt) return null;

    const now = Date.now();
    const startTime = fight.startedAt.getTime();
    const endTime = startTime + fight.durationMinutes * 60 * 1000;
    const timeRemainingMs = Math.max(0, endTime - now);

    // Fetch prices once for all participants (cached)
    const prices = await getPrices();

    // Get participant states from recorded trades and live positions
    const participantStates = await Promise.all(
      fight.participants.map(async (p) => {
        // Get all PnL data from FightTrade records for THIS specific fight
        const liveData = await calculateUnrealizedPnlFromFightTrades(fight.id, p.userId, prices);
        const { realizedPnl, unrealizedPnl, fees, funding, margin, tradesCount } = liveData;

        // Per user requirement: PnL should ONLY update when positions are CLOSED
        // Both live display and settlement use realized PnL only
        // Opening a position (long/short) doesn't affect PnL - only closing does
        // Note: Platform fee is already included in Pacifica's fee via Builder Code
        const totalPnl = realizedPnl; // Only closed positions count

        // For pnlPercent (ROI%), we use PnL / margin * 100
        // When margin = 0 (all positions closed), fall back to maxExposureUsed
        // This ensures we show realized ROI% even after closing positions
        const maxExposure = Number(p.maxExposureUsed || 0);
        const effectiveMargin = margin > 0 ? margin : maxExposure;
        const pnlPercent = effectiveMargin > 0 ? (totalPnl / effectiveMargin) * 100 : 0;

        // scoreUsdc is the actual PnL in USD
        const scoreUsdc = totalPnl;

        return {
          userId: p.userId,
          handle: p.user.handle,
          slot: p.slot as 'A' | 'B',
          pnlPercent,
          scoreUsdc,
          tradesCount,
          realizedPnl,
          unrealizedPnl,
          fees,
          funding,
          positionValue: liveData.totalPositionValue,
          margin,
        };
      })
    );

    const participantA = participantStates.find((p) => p.slot === 'A') || null;
    const participantB = participantStates.find((p) => p.slot === 'B') || null;

    // Determine leader (use tolerance to avoid flickering due to float precision)
    const EPSILON = 0.0001;
    let leader: string | null = null;
    if (participantA && participantB) {
      const diff = participantA.pnlPercent - participantB.pnlPercent;
      if (Math.abs(diff) >= EPSILON) {
        // Only set leader if difference is significant
        leader = diff > 0 ? participantA.userId : participantB.userId;
      }
      // If difference < EPSILON, leader stays null (tie)
    }

    return {
      fightId: fight.id,
      status: fight.status,
      durationMinutes: fight.durationMinutes,
      stakeUsdc: fight.stakeUsdc,
      startedAt: fight.startedAt,
      endsAt: new Date(endTime),
      participantA,
      participantB,
      leader,
      timeRemainingMs,
    };
  }

  /**
   * Get current fight state (for initial load)
   */
  async getFightState(fightId: string): Promise<FightState | null> {
    // Check cache first
    if (this.activeFights.has(fightId)) {
      return this.activeFights.get(fightId)!;
    }

    // Load from database
    const fight = await prisma.fight.findUnique({
      where: { id: fightId },
      include: {
        participants: {
          include: { user: true },
        },
      },
    });

    if (!fight) return null;

    return this.calculateFightState(fight);
  }

  /**
   * Handle fight start
   */
  async onFightStarted(fightId: string) {
    const state = await this.getFightState(fightId);

    if (state) {
      this.activeFights.set(fightId, state);

      // Emit FIGHT_STARTED to all clients in the fight room
      this.io.to(`fight:${fightId}`).emit(WS_EVENTS.FIGHT_STARTED, {
        fightId,
        startedAt: state.startedAt,
        endsAt: state.endsAt,
        participantA: state.participantA
          ? { userId: state.participantA.userId, handle: state.participantA.handle }
          : null,
        participantB: state.participantB
          ? { userId: state.participantB.userId, handle: state.participantB.handle }
          : null,
      });

      logger.info(LOG_EVENTS.FIGHT_START, 'Fight started', { fightId });
    }
  }

  /**
   * Check for external trades for all participants in a fight
   */
  private async checkExternalTrades(fight: {
    id: string;
    startedAt: Date | null;
    participants: Array<{ id: string; userId: string; externalTradesDetected: boolean }>;
  }) {
    if (!fight.startedAt) return;

    logger.info(LOG_EVENTS.FIGHT_ACTIVITY, 'Starting external trades check', {
      fightId: fight.id,
      participantCount: fight.participants.length,
      participants: fight.participants.map((p) => ({
        id: p.id,
        userId: p.userId,
        alreadyDetected: p.externalTradesDetected,
      })),
    });

    for (const participant of fight.participants) {
      // Skip if already detected
      if (participant.externalTradesDetected) {
        logger.info(LOG_EVENTS.FIGHT_ACTIVITY, 'Skipping participant - already detected', {
          fightId: fight.id,
          participantId: participant.id,
          userId: participant.userId,
        });
        continue;
      }

      // Get Pacifica connection for this user
      const connection = await prisma.pacificaConnection.findUnique({
        where: { userId: participant.userId },
        select: { accountAddress: true },
      });

      if (!connection) {
        logger.warn(LOG_EVENTS.FIGHT_ACTIVITY, 'No Pacifica connection for user', {
          fightId: fight.id,
          userId: participant.userId,
        });
        continue;
      }

      const result = await detectExternalTrades(
        fight.id,
        participant.userId,
        connection.accountAddress,
        fight.startedAt,
        new Date()
      );

      if (result.detected) {
        // Update database
        await prisma.fightParticipant.update({
          where: { id: participant.id },
          data: {
            externalTradesDetected: true,
            externalTradeIds: result.externalTradeIds,
          },
        });

        // Emit event to fight room
        this.io.to(`fight:${fight.id}`).emit(WS_EVENTS.EXTERNAL_TRADES_DETECTED, {
          fightId: fight.id,
          userId: participant.userId,
          count: result.externalTradeIds.length,
          tradeIds: result.externalTradeIds,
        });

        logger.warn(LOG_EVENTS.API_ERROR, 'External trades detected and recorded', {
          fightId: fight.id,
          userId: participant.userId,
          count: result.externalTradeIds.length,
        });
      }
    }
  }

  /**
   * Save a snapshot of the current fight state to the database
   * Used for historical tracking and PnL timeline graphs
   *
   * Note: Snapshots are saved every 5 seconds (SNAPSHOT_SAVE_INTERVAL)
   * A 5-minute fight generates ~60 snapshots per fight
   * Consider adding a cleanup job to delete old snapshots (e.g., > 30 days)
   */
  private async saveSnapshot(state: FightState) {
    if (!state.participantA || !state.participantB) return;

    try {
      await prisma.fightSnapshot.create({
        data: {
          fightId: state.fightId,
          participantAUserId: state.participantA.userId,
          participantAPnlPercent: state.participantA.pnlPercent,
          participantAScoreUsdc: state.participantA.scoreUsdc,
          participantATradesCount: state.participantA.tradesCount,
          participantBUserId: state.participantB.userId,
          participantBPnlPercent: state.participantB.pnlPercent,
          participantBScoreUsdc: state.participantB.scoreUsdc,
          participantBTradesCount: state.participantB.tradesCount,
          leaderId: state.leader,
        },
      });

      logger.debug(LOG_EVENTS.SCORING_SNAPSHOT_WRITE, 'Fight snapshot saved', {
        fightId: state.fightId,
        timeRemainingMs: state.timeRemainingMs,
      });
    } catch (error) {
      // Log but don't fail the tick - snapshots are not critical
      logger.error(LOG_EVENTS.API_ERROR, 'Failed to save fight snapshot', error as Error, {
        fightId: state.fightId,
      });
    }
  }

  /**
   * Handle lead change
   */
  private onLeadChanged(fightId: string, newLeader: string | null, previousLeader: string | null) {
    this.io.to(`fight:${fightId}`).emit(WS_EVENTS.LEAD_CHANGED, {
      fightId,
      newLeader,
      previousLeader,
      timestamp: Date.now(),
    });

    logger.info(LOG_EVENTS.FIGHT_LEAD_CHANGED, 'Lead changed', {
      fightId,
      newLeader,
      previousLeader,
    });
  }

  /**
   * End a fight
   */
  private async endFight(fightId: string, state: FightState) {
    logger.info(LOG_EVENTS.FIGHT_FINISH, 'Ending fight', { fightId });

    // Final check for external trades before ending
    const fight = await prisma.fight.findUnique({
      where: { id: fightId },
      include: {
        participants: {
          include: { user: { select: { id: true, handle: true } } },
        },
      },
    });

    if (!fight) {
      logger.error(LOG_EVENTS.FIGHT_ACTIVITY, 'Fight not found for settlement', { fightId });
      return;
    }

    if (fight.startedAt) {
      await this.checkExternalTrades({
        id: fight.id,
        startedAt: fight.startedAt,
        participants: fight.participants,
      });
    }

    // Recalculate state to get final REALIZED PnL
    // Only closed positions count for winner determination
    const settlementState = await this.calculateFightState({
      id: fight.id,
      status: fight.status,
      durationMinutes: fight.durationMinutes,
      stakeUsdc: fight.stakeUsdc,
      startedAt: fight.startedAt,
      participants: fight.participants,
    });

    // Use settlement state for final scores, fallback to live state if calculation fails
    const finalState = settlementState || state;

    // Update participant final scores FIRST (needed for anti-cheat validation)
    if (finalState.participantA) {
      await prisma.fightParticipant.updateMany({
        where: { fightId, userId: finalState.participantA.userId },
        data: {
          finalPnlPercent: finalState.participantA.pnlPercent,
          finalScoreUsdc: finalState.participantA.scoreUsdc,
          tradesCount: finalState.participantA.tradesCount,
        },
      });
    }

    if (finalState.participantB) {
      await prisma.fightParticipant.updateMany({
        where: { fightId, userId: finalState.participantB.userId },
        data: {
          finalPnlPercent: finalState.participantB.pnlPercent,
          finalScoreUsdc: finalState.participantB.scoreUsdc,
          tradesCount: finalState.participantB.tradesCount,
        },
      });
    }

    // Determine winner based on REALIZED PnL only
    // Use tolerance for floating point comparison to avoid false wins due to precision errors
    // 0.0001% difference is considered a draw (both displayed as same percentage)
    const EPSILON = 0.0001;
    let determinedWinnerId: string | null = null;
    let determinedDraw = false;

    if (finalState.participantA && finalState.participantB) {
      const diff = finalState.participantA.pnlPercent - finalState.participantB.pnlPercent;
      if (Math.abs(diff) < EPSILON) {
        // Difference is negligible - it's a draw
        determinedDraw = true;
      } else if (diff > 0) {
        determinedWinnerId = finalState.participantA.userId;
      } else {
        determinedWinnerId = finalState.participantB.userId;
      }
    }

    // Call anti-cheat API to validate fight and get final status
    let finalStatus: 'FINISHED' | 'NO_CONTEST' = 'FINISHED';
    let winnerId = determinedWinnerId;
    let isDraw = determinedDraw;

    try {
      const response = await fetch(`${WEB_API_URL}/api/internal/anti-cheat/settle`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Internal-Key': INTERNAL_API_KEY,
        },
        body: JSON.stringify({
          fightId,
          determinedWinnerId,
          isDraw: determinedDraw,
        }),
      });

      if (response.ok) {
        const result = await response.json() as {
          success: boolean;
          finalStatus: 'FINISHED' | 'NO_CONTEST';
          winnerId: string | null;
          isDraw: boolean;
          violations?: Array<{ ruleCode: string }>;
        };
        if (result.success) {
          finalStatus = result.finalStatus;
          winnerId = result.winnerId;
          isDraw = result.isDraw;

          if (result.violations && result.violations.length > 0) {
            logger.warn(LOG_EVENTS.FIGHT_ACTIVITY, 'Fight settled with anti-cheat violations', {
              fightId,
              finalStatus,
              violationCount: result.violations.length,
              violations: result.violations.map((v: { ruleCode: string }) => v.ruleCode),
            });
          }
        }
      } else {
        logger.error(LOG_EVENTS.API_ERROR, 'Anti-cheat API returned error', {
          fightId,
          status: response.status,
        });
      }
    } catch (error) {
      // If anti-cheat API fails, continue with normal settlement
      logger.error(LOG_EVENTS.API_ERROR, 'Failed to call anti-cheat API', {
        fightId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }

    // Update database with final status from anti-cheat
    await prisma.fight.update({
      where: { id: fightId },
      data: {
        status: finalStatus === 'NO_CONTEST' ? FightStatus.NO_CONTEST : FightStatus.FINISHED,
        endedAt: new Date(),
        winnerId,
        isDraw,
      },
    });

    // Remove from active fights and cleanup warning tracking
    this.activeFights.delete(fightId);
    this.fightWarningsSent.delete(fightId);

    // Emit FIGHT_FINISHED with settlement scores (realized PnL only)
    this.io.to(`fight:${fightId}`).emit(WS_EVENTS.FIGHT_FINISHED, {
      fightId,
      status: finalStatus,
      winnerId,
      isDraw,
      finalScores: {
        participantA: finalState.participantA
          ? {
              userId: finalState.participantA.userId,
              pnlPercent: finalState.participantA.pnlPercent,
              scoreUsdc: finalState.participantA.scoreUsdc,
            }
          : null,
        participantB: finalState.participantB
          ? {
              userId: finalState.participantB.userId,
              pnlPercent: finalState.participantB.pnlPercent,
              scoreUsdc: finalState.participantB.scoreUsdc,
            }
          : null,
      },
    });

    logger.info(LOG_EVENTS.FIGHT_FINISH, 'Fight finished', {
      fightId,
      status: finalStatus,
      winnerId,
      isDraw,
    });

    // Broadcast to arena subscribers
    this.broadcastArenaFightEnded(fightId);

    // Emit updated platform stats
    this.emitPlatformStats().catch(err => {
      logger.error(LOG_EVENTS.API_ERROR, 'Failed to emit platform stats after fight end', err as Error);
    });
  }

  // ─────────────────────────────────────────────────────────────
  // Platform Stats
  // ─────────────────────────────────────────────────────────────

  /**
   * Fetch and emit platform stats to all connected clients
   */
  async emitPlatformStats() {
    try {
      const [volumeResult, fightsCount, fightVolumeResult, totalFeesResult, activeUsersCount, totalTradesCount] =
        await Promise.all([
          prisma.$queryRaw<[{ total_volume: number }]>`
            SELECT COALESCE(SUM(amount * price), 0)::float as total_volume FROM trades
          `,
          prisma.fight.count({
            where: { status: FightStatus.FINISHED },
          }),
          prisma.$queryRaw<[{ fight_volume: number }]>`
            SELECT COALESCE(SUM(stake_usdc), 0)::float as fight_volume FROM fights
          `,
          prisma.$queryRaw<[{ total_fees: number }]>`
            SELECT COALESCE(SUM(fee), 0)::float as total_fees FROM trades
          `,
          prisma.$queryRaw<[{ count: bigint }]>`
            SELECT COUNT(DISTINCT user_id) as count FROM trades
          `,
          prisma.trade.count(),
        ]);

      const stats: PlatformStatsPayload = {
        tradingVolume: volumeResult[0]?.total_volume || 0,
        fightVolume: fightVolumeResult[0]?.fight_volume || 0,
        fightsCompleted: fightsCount,
        totalFees: totalFeesResult[0]?.total_fees || 0,
        activeUsers: Number(activeUsersCount[0]?.count || 0),
        totalTrades: totalTradesCount,
        timestamp: Date.now(),
      };

      // Emit to all connected clients
      this.io.emit(WS_EVENTS.PLATFORM_STATS, stats);

      logger.info(LOG_EVENTS.WS_BROADCAST, 'Platform stats emitted', {
        tradingVolume: stats.tradingVolume,
        fightsCompleted: stats.fightsCompleted,
      });
    } catch (error) {
      logger.error(LOG_EVENTS.API_ERROR, 'Failed to emit platform stats', error as Error);
    }
  }

  // ─────────────────────────────────────────────────────────────
  // Arena broadcast methods (for lobby real-time updates)
  // ─────────────────────────────────────────────────────────────

  /**
   * Broadcast fight created event to arena subscribers
   */
  async broadcastArenaFightCreated(fightId: string) {
    const fight = await this.loadFightForArena(fightId);
    if (fight) {
      this.io.to('arena').emit(WS_EVENTS.ARENA_FIGHT_CREATED, this.formatFightForArena(fight));
      logger.info(LOG_EVENTS.WS_SUBSCRIBE, 'Arena: Fight created broadcast', { fightId });
    }
  }

  /**
   * Broadcast fight updated event to arena subscribers
   */
  async broadcastArenaFightUpdated(fightId: string) {
    const fight = await this.loadFightForArena(fightId);
    if (fight) {
      this.io.to('arena').emit(WS_EVENTS.ARENA_FIGHT_UPDATED, this.formatFightForArena(fight));
      logger.info(LOG_EVENTS.WS_SUBSCRIBE, 'Arena: Fight updated broadcast', { fightId });
    }
  }

  /**
   * Broadcast fight started event to arena subscribers
   */
  async broadcastArenaFightStarted(fightId: string) {
    const fight = await this.loadFightForArena(fightId);
    if (fight) {
      this.io.to('arena').emit(WS_EVENTS.ARENA_FIGHT_STARTED, this.formatFightForArena(fight));
      logger.info(LOG_EVENTS.WS_SUBSCRIBE, 'Arena: Fight started broadcast', { fightId });
    }
  }

  /**
   * Broadcast fight ended event to arena subscribers
   */
  async broadcastArenaFightEnded(fightId: string) {
    const fight = await this.loadFightForArena(fightId);
    if (fight) {
      this.io.to('arena').emit(WS_EVENTS.ARENA_FIGHT_ENDED, this.formatFightForArena(fight));
      logger.info(LOG_EVENTS.WS_SUBSCRIBE, 'Arena: Fight ended broadcast', { fightId });
    }
  }

  /**
   * Broadcast fight deleted event to arena subscribers
   */
  broadcastArenaFightDeleted(fightId: string) {
    this.io.to('arena').emit(WS_EVENTS.ARENA_FIGHT_DELETED, { fightId });
    logger.info(LOG_EVENTS.WS_SUBSCRIBE, 'Arena: Fight deleted broadcast', { fightId });
  }

  /**
   * Load fight data for arena broadcasting
   */
  private async loadFightForArena(fightId: string): Promise<FightWithParticipants | null> {
    return prisma.fight.findUnique({
      where: { id: fightId },
      include: {
        creator: true,
        participants: {
          include: { user: true },
        },
      },
    });
  }

  /**
   * Format fight data for arena events
   */
  private formatFightForArena(fight: FightWithParticipants) {
    return {
      id: fight.id,
      status: fight.status,
      durationMinutes: fight.durationMinutes,
      stakeUsdc: fight.stakeUsdc,
      createdAt: fight.createdAt,
      startedAt: fight.startedAt,
      endedAt: fight.endedAt,
      winnerId: fight.winnerId,
      isDraw: fight.isDraw,
      creator: fight.creator ? {
        id: fight.creator.id,
        handle: fight.creator.handle,
        avatarUrl: fight.creator.avatarUrl,
      } : null,
      participants: fight.participants.map(p => ({
        id: p.id,
        userId: p.userId,
        slot: p.slot,
        finalPnlPercent: p.finalPnlPercent,
        finalScoreUsdc: p.finalScoreUsdc,
        tradesCount: p.tradesCount,
        user: {
          id: p.user.id,
          handle: p.user.handle,
          avatarUrl: p.user.avatarUrl,
        },
      })),
    };
  }
}
