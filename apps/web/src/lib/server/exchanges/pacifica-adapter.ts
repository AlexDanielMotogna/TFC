/**
 * Pacifica Exchange Adapter
 * Wraps existing Pacifica API client with normalized interface
 */

import * as nacl from 'tweetnacl';
import * as Pacifica from '../pacifica';
import * as PacificaSigning from '../pacifica-signing';
import {
  ExchangeAdapter,
  AuthContext,
  Market,
  Price,
  Orderbook,
  Candle,
  RecentTrade,
  Account,
  Position,
  Order,
  OrderSide,
  OrderType,
  TimeInForce,
  TradeHistoryItem,
  AccountSetting,
  MarketOrderParams,
  LimitOrderParams,
  CancelOrderParams,
  CancelAllOrdersParams,
  KlineParams,
  TradeHistoryParams,
} from './adapter';

/**
 * Pacifica exchange adapter
 * Wraps existing Pacifica API client with normalized interface
 */
export class PacificaAdapter implements ExchangeAdapter {
  readonly name = 'pacifica';
  readonly version = 'v1';

  private builderCode: string;

  constructor(builderCode: string = process.env.PACIFICA_BUILDER_CODE || 'TradeClub') {
    this.builderCode = builderCode;
  }

  // ─────────────────────────────────────────────────────────────
  // Public Market Data
  // ─────────────────────────────────────────────────────────────

  async getMarkets(): Promise<Market[]> {
    const pacificaMarkets = await Pacifica.getMarkets();

    return pacificaMarkets.map((m) => ({
      symbol: this.normalizeSymbol(m.symbol), // BTC → BTC-USD
      baseAsset: m.symbol,
      quoteAsset: 'USD',
      tickSize: m.tick_size,
      stepSize: m.step_size,
      minOrderSize: m.min_order_size,
      maxOrderSize: m.max_order_size,
      minNotional: m.min_order_notional,
      maxLeverage: m.max_leverage,
      fundingRate: m.funding,
      fundingInterval: 8, // Pacifica: 8 hours
      metadata: {
        makerFee: m.maker_fee,
        takerFee: m.taker_fee,
        openInterest: m.open_interest,
        impactNotional: m.impact_notional,
      },
    }));
  }

  async getPrices(): Promise<Price[]> {
    const pacificaPrices = await Pacifica.getPrices();

    return pacificaPrices.map((p) => ({
      symbol: this.normalizeSymbol(p.symbol),
      mark: p.mark,
      index: p.oracle,
      last: p.mark, // Pacifica doesn't have last trade price, use mark
      bid: '0', // Not available in prices endpoint
      ask: '0',
      funding: p.funding,
      volume24h: p.volume_24h,
      change24h: p.change_24h || '0',
      timestamp: Date.now(),
    }));
  }

  async getOrderbook(symbol: string, aggLevel = 1): Promise<Orderbook> {
    const pacificaSymbol = this.denormalizeSymbol(symbol); // BTC-USD → BTC
    const orderbook = await Pacifica.getOrderbook(pacificaSymbol, aggLevel);

    return {
      symbol,
      bids: orderbook.bids.map((b) => [b.price, b.size]),
      asks: orderbook.asks.map((a) => [a.price, a.size]),
      timestamp: Date.now(),
    };
  }

  async getKlines(params: KlineParams): Promise<Candle[]> {
    const pacificaSymbol = this.denormalizeSymbol(params.symbol);
    const candles = await Pacifica.getKlines({
      symbol: pacificaSymbol,
      interval: params.interval,
      startTime: params.startTime || Date.now() - 24 * 60 * 60 * 1000, // Default: last 24h
      endTime: params.endTime,
    });

    return candles.map((c) => ({
      timestamp: c.timestamp,
      open: c.open,
      high: c.high,
      low: c.low,
      close: c.close,
      volume: c.volume,
    }));
  }

  async getRecentTrades(symbol: string): Promise<RecentTrade[]> {
    const pacificaSymbol = this.denormalizeSymbol(symbol);
    const trades = await Pacifica.getRecentTrades(pacificaSymbol);

    return trades.map((t) => ({
      id: t.trade_id.toString(),
      symbol,
      side: t.side === 'bid' ? 'BUY' : 'SELL',
      price: t.price,
      amount: t.amount,
      timestamp: t.timestamp,
    }));
  }

  // ─────────────────────────────────────────────────────────────
  // Account Data
  // ─────────────────────────────────────────────────────────────

  async getAccount(accountId: string): Promise<Account> {
    const account = await Pacifica.getAccount(accountId);

    return {
      accountId,
      balance: account.balance,
      accountEquity: account.account_equity,
      availableToSpend: account.available_to_spend,
      marginUsed: account.total_margin_used,
      unrealizedPnl: account.unrealized_pnl,
      makerFee: account.maker_fee,
      takerFee: account.taker_fee,
      metadata: {
        vaultBalance: account.vault_balance,
        totalDeposits: account.total_deposits,
        totalWithdrawals: account.total_withdrawals,
        totalVolume: account.total_volume,
        totalPnl: account.total_pnl,
        availableToWithdraw: account.available_to_withdraw,
        pendingBalance: account.pending_balance,
        crossMmr: account.cross_mmr,
        positionsCount: account.positions_count,
        ordersCount: account.orders_count,
        feeLevel: account.fee_level,
      },
    };
  }

  async getPositions(accountId: string): Promise<Position[]> {
    const positions = await Pacifica.getPositions(accountId);

    return positions.map((p) => ({
      symbol: this.normalizeSymbol(p.symbol),
      side: p.side === 'bid' ? 'LONG' : 'SHORT',
      amount: p.amount,
      entryPrice: p.entry_price,
      markPrice: p.mark,
      margin: p.margin,
      leverage: p.leverage.toString(),
      unrealizedPnl: p.unrealized_pnl,
      liquidationPrice: p.liquidation_price,
      funding: p.funding,
      metadata: {
        openedAt: p.opened_at,
        maxLeverage: p.max_leverage,
      },
    }));
  }

  async getOpenOrders(accountId: string): Promise<Order[]> {
    const orders = await Pacifica.getOpenOrders(accountId);

    return orders.map((o) => ({
      orderId: o.order_id,
      clientOrderId: o.client_order_id,
      symbol: this.normalizeSymbol(o.symbol),
      side: o.side === 'bid' ? 'BUY' : 'SELL',
      type: this.normalizeOrderType(o.order_type),
      price: o.price,
      amount: o.amount,
      filled: o.filled,
      remaining: o.remaining,
      status: this.normalizeOrderStatus(o.status),
      timeInForce: this.normalizeTimeInForce(o.tif),
      reduceOnly: o.reduce_only,
      createdAt: new Date(o.created_at).getTime(),
      updatedAt: new Date(o.updated_at || o.created_at).getTime(),
      metadata: {
        triggerPrice: o.trigger_price,
      },
    }));
  }

  async getTradeHistory(params: TradeHistoryParams): Promise<TradeHistoryItem[]> {
    const trades = await Pacifica.getTradeHistory({
      accountAddress: params.accountId,
      symbol: params.symbol ? this.denormalizeSymbol(params.symbol) : undefined,
      startTime: params.startTime,
      endTime: params.endTime,
      limit: params.limit,
    });

    return trades.map((t) => ({
      historyId: t.history_id.toString(),
      orderId: t.order_id,
      symbol: this.normalizeSymbol(t.symbol),
      side: this.normalizeTradeSide(t.side),
      amount: t.amount,
      price: t.price,
      fee: t.fee,
      pnl: t.pnl,
      executedAt: new Date(t.created_at).getTime(),
      metadata: {
        position: t.side, // open_long, close_short, etc.
        leverage: t.leverage,
      },
    }));
  }

  async getAccountSettings(accountId: string): Promise<AccountSetting[]> {
    const settings = await Pacifica.getAccountSettings(accountId);

    return settings.map((s) => ({
      symbol: this.normalizeSymbol(s.symbol),
      leverage: s.leverage,
      metadata: {},
    }));
  }

  // ─────────────────────────────────────────────────────────────
  // Trading Operations
  // ─────────────────────────────────────────────────────────────

  async createMarketOrder(
    auth: AuthContext,
    params: MarketOrderParams
  ): Promise<{ orderId: string | number }> {
    const keypair = this.extractKeypair(auth);
    const pacificaSymbol = this.denormalizeSymbol(params.symbol);

    const result = await Pacifica.createMarketOrder(keypair, {
      symbol: pacificaSymbol,
      amount: params.amount,
      side: params.side === 'BUY' ? 'bid' : 'ask',
      slippagePercent: params.slippagePercent || '1',
      reduceOnly: params.reduceOnly || false,
      clientOrderId: params.clientOrderId,
    });

    return { orderId: result.order_id };
  }

  async createLimitOrder(
    auth: AuthContext,
    params: LimitOrderParams
  ): Promise<{ orderId: string | number }> {
    const keypair = this.extractKeypair(auth);
    const pacificaSymbol = this.denormalizeSymbol(params.symbol);

    const result = await Pacifica.createLimitOrder(keypair, {
      symbol: pacificaSymbol,
      price: params.price,
      amount: params.amount,
      side: params.side === 'BUY' ? 'bid' : 'ask',
      tif: this.denormalizeTimeInForce(params.timeInForce || 'GTC'),
      reduceOnly: params.reduceOnly || false,
      clientOrderId: params.clientOrderId,
    });

    return { orderId: result.order_id };
  }

  async cancelOrder(
    auth: AuthContext,
    params: CancelOrderParams
  ): Promise<{ success: boolean }> {
    const keypair = this.extractKeypair(auth);
    const pacificaSymbol = this.denormalizeSymbol(params.symbol);

    const result = await Pacifica.cancelOrder(keypair, {
      symbol: pacificaSymbol,
      orderId: params.orderId ? Number(params.orderId) : undefined,
      clientOrderId: params.clientOrderId,
    });

    return { success: result.success };
  }

  async cancelAllOrders(
    auth: AuthContext,
    params: CancelAllOrdersParams
  ): Promise<{ cancelledCount: number }> {
    const keypair = this.extractKeypair(auth);

    const result = await Pacifica.cancelAllOrders(keypair, {
      allSymbols: !params.symbol,
      symbol: params.symbol ? this.denormalizeSymbol(params.symbol) : undefined,
      excludeReduceOnly: params.excludeReduceOnly,
    });

    return { cancelledCount: result.cancelled_count };
  }

  async updateLeverage(
    auth: AuthContext,
    symbol: string,
    leverage: number
  ): Promise<{ success: boolean }> {
    const keypair = this.extractKeypair(auth);
    const pacificaSymbol = this.denormalizeSymbol(symbol);

    const result = await Pacifica.updateLeverage(keypair, {
      symbol: pacificaSymbol,
      leverage,
    });

    return { success: result.success };
  }

  // Pacifica-specific: Builder code approval
  async approveBuilderCode(
    auth: AuthContext,
    builderCode: string,
    maxFeeRate: number
  ): Promise<{ success: boolean }> {
    const keypair = this.extractKeypair(auth);

    const result = await Pacifica.approveBuilderCode(keypair, {
      builderCode,
      maxFeeRate,
    });

    return { success: result.success };
  }

  // Pacifica-specific: Withdraw funds
  async withdraw(auth: AuthContext, amount: string): Promise<{ success: boolean }> {
    const keypair = this.extractKeypair(auth);

    const result = await Pacifica.withdraw(keypair, { amount });

    return { success: result.success };
  }

  // ─────────────────────────────────────────────────────────────
  // Helper Methods
  // ─────────────────────────────────────────────────────────────

  private normalizeSymbol(pacificaSymbol: string): string {
    // BTC → BTC-USD
    return `${pacificaSymbol}-USD`;
  }

  private denormalizeSymbol(symbol: string): string {
    // BTC-USD → BTC
    return symbol.replace('-USD', '');
  }

  private normalizeOrderType(pacificaType: string): OrderType {
    if (pacificaType === 'market') return 'MARKET';
    if (pacificaType === 'limit') return 'LIMIT';
    if (pacificaType === 'stop_loss_market') return 'STOP_MARKET';
    if (pacificaType === 'stop_loss_limit') return 'STOP_LIMIT';
    if (pacificaType === 'take_profit_market') return 'TAKE_PROFIT_MARKET';
    if (pacificaType === 'take_profit_limit') return 'TAKE_PROFIT_LIMIT';
    return 'MARKET'; // Fallback
  }

  private normalizeOrderStatus(pacificaStatus: string): Order['status'] {
    if (pacificaStatus === 'open') return 'OPEN';
    if (pacificaStatus === 'partially_filled') return 'PARTIALLY_FILLED';
    if (pacificaStatus === 'filled') return 'FILLED';
    if (pacificaStatus === 'cancelled') return 'CANCELLED';
    if (pacificaStatus === 'rejected') return 'REJECTED';
    return 'OPEN'; // Fallback
  }

  private normalizeTimeInForce(pacificaTif: string): TimeInForce {
    if (pacificaTif === 'GTC') return 'GTC';
    if (pacificaTif === 'IOC') return 'IOC';
    if (pacificaTif === 'ALO' || pacificaTif === 'TOB') return 'POST_ONLY'; // Map to POST_ONLY
    return 'GTC'; // Fallback
  }

  private denormalizeTimeInForce(tif: TimeInForce): 'GTC' | 'IOC' | 'ALO' | 'TOB' {
    if (tif === 'GTC') return 'GTC';
    if (tif === 'IOC') return 'IOC';
    if (tif === 'POST_ONLY') return 'ALO'; // Map to ALO (add liquidity only)
    if (tif === 'FOK') return 'IOC'; // Pacifica doesn't have FOK, use IOC
    return 'GTC'; // Fallback
  }

  private normalizeTradeSide(pacificaSide: string): OrderSide {
    // Pacifica sides: open_long, open_short, close_long, close_short
    // open_long, close_short = BUY
    // open_short, close_long = SELL
    if (pacificaSide.includes('long') || pacificaSide === 'close_short') {
      return 'BUY';
    }
    return 'SELL';
  }

  private extractKeypair(auth: AuthContext): nacl.SignKeyPair {
    if (auth.credentials.type !== 'pacifica') {
      throw new Error('Invalid credentials type for Pacifica adapter');
    }

    return PacificaSigning.keypairFromPrivateKey(auth.credentials.privateKey);
  }
}
