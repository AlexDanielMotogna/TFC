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
  StopOrderParams,
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
      stepSize: m.lot_size, // Pacifica uses lot_size for step size
      minOrderSize: m.min_order_size,
      maxOrderSize: m.max_order_size,
      minNotional: '0', // Not available in MarketInfo
      maxLeverage: m.max_leverage,
      fundingRate: m.funding_rate,
      fundingInterval: 8, // Pacifica: 8 hours
      metadata: {
        minTick: m.min_tick,
        maxTick: m.max_tick,
        isolatedOnly: m.isolated_only,
        nextFundingRate: m.next_funding_rate,
        createdAt: m.created_at,
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
      change24h: '0', // Can be calculated from yesterday_price if needed
      timestamp: p.timestamp,
    }));
  }

  async getOrderbook(symbol: string, aggLevel = 1): Promise<Orderbook> {
    const pacificaSymbol = this.denormalizeSymbol(symbol); // BTC-USD → BTC
    const orderbook = await Pacifica.getOrderbook(pacificaSymbol, aggLevel);

    // Pacifica orderbook format: { s: symbol, l: [[{p, a, n}], [{p, a, n}]], t: timestamp }
    // l[0] = bids, l[1] = asks
    const bids = orderbook.l[0]?.map((level) => [level.p, level.a]) || [];
    const asks = orderbook.l[1]?.map((level) => [level.p, level.a]) || [];

    return {
      symbol,
      bids: bids as [string, string][],
      asks: asks as [string, string][],
      timestamp: orderbook.t,
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

    // Pacifica returns {t, o, h, l, c, v} format, normalize to adapter format
    return candles.map((c: any) => ({
      timestamp: c.t || c.timestamp,
      open: c.o || c.open,
      high: c.h || c.high,
      low: c.l || c.low,
      close: c.c || c.close,
      volume: c.v || c.volume,
    }));
  }

  async getRecentTrades(symbol: string): Promise<RecentTrade[]> {
    const pacificaSymbol = this.denormalizeSymbol(symbol);
    const trades = await Pacifica.getRecentTrades(pacificaSymbol);

    return trades.map((t, index) => ({
      id: `${t.created_at}-${index}`, // Use timestamp + index as unique ID
      symbol,
      side: t.side === 'bid' ? 'BUY' : 'SELL',
      price: t.price,
      amount: t.amount,
      timestamp: t.created_at,
    }));
  }

  // ─────────────────────────────────────────────────────────────
  // Account Data
  // ─────────────────────────────────────────────────────────────

  async getAccount(accountId: string): Promise<Account> {
    const account = await Pacifica.getAccount(accountId);

    // Calculate unrealized PnL by fetching positions
    const positions = await Pacifica.getPositions(accountId);
    const unrealizedPnl = positions
      .reduce((sum, pos: any) => sum + parseFloat(pos.unrealized_pnl || '0'), 0)
      .toString();

    return {
      accountId,
      balance: account.balance,
      accountEquity: account.account_equity,
      availableToSpend: account.available_to_spend,
      marginUsed: account.total_margin_used,
      unrealizedPnl,
      makerFee: account.maker_fee,
      takerFee: account.taker_fee,
      metadata: {
        availableToWithdraw: account.available_to_withdraw,
        pendingBalance: account.pending_balance,
        crossMmr: account.cross_mmr,
        positionsCount: account.positions_count,
        ordersCount: account.orders_count,
        stopOrdersCount: account.stop_orders_count,
        feeLevel: account.fee_level,
        useLtpForStopOrders: account.use_ltp_for_stop_orders,
        updatedAt: account.updated_at,
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
      markPrice: '0', // Not available in Position, would need to fetch from getPrices()
      margin: p.margin,
      leverage: p.leverage,
      unrealizedPnl: '0', // Not available in Position response
      liquidationPrice: p.liq_price,
      funding: p.funding,
      metadata: {
        isolated: p.isolated,
        createdAt: p.created_at,
        updatedAt: p.updated_at,
      },
    }));
  }

  async getOpenOrders(accountId: string): Promise<Order[]> {
    const orders = await Pacifica.getOpenOrders(accountId);

    return orders.map((o) => ({
      orderId: o.order_id,
      clientOrderId: o.client_order_id || undefined,
      symbol: this.normalizeSymbol(o.symbol),
      side: o.side === 'bid' ? 'BUY' : 'SELL',
      type: this.normalizeOrderType(o.order_type),
      price: o.price,
      amount: o.initial_amount,
      filled: o.filled_amount,
      remaining: (parseFloat(o.initial_amount) - parseFloat(o.filled_amount) - parseFloat(o.cancelled_amount || '0')).toString(),
      status: this.inferOrderStatus(o),
      timeInForce: 'GTC', // Not available in OpenOrder, default to GTC
      reduceOnly: o.reduce_only,
      createdAt: o.created_at,
      updatedAt: o.updated_at,
      metadata: {
        stopPrice: o.stop_price,
        stopParentOrderId: o.stop_parent_order_id,
        cancelledAmount: o.cancelled_amount,
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
      orderId: t.order_id.toString(),
      symbol: this.normalizeSymbol(t.symbol),
      side: this.normalizeTradeSide(t.side),
      amount: t.amount,
      price: t.price,
      fee: t.fee,
      pnl: t.pnl,
      executedAt: t.created_at,
      metadata: {
        position: t.side, // open_long, close_short, etc.
        eventType: t.event_type,
        entryPrice: t.entry_price,
        cause: t.cause,
        clientOrderId: t.client_order_id,
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

  async createStopOrder(
    auth: AuthContext,
    params: StopOrderParams
  ): Promise<{ orderId: string | number }> {
    const keypair = this.extractKeypair(auth);
    const pacificaSymbol = this.denormalizeSymbol(params.symbol);

    const result = await Pacifica.createStopOrder(keypair, {
      symbol: pacificaSymbol,
      side: params.side === 'BUY' ? 'bid' : 'ask',
      amount: params.amount,
      stopPrice: params.stopPrice,
      limitPrice: params.limitPrice,
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
      excludeReduceOnly: params.excludeReduceOnly || false,
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

    // Pacifica.approveBuilderCode takes (keypair, maxFeeRate as string)
    // It uses the BUILDER_CODE constant, so we ignore the builderCode param
    const result = await Pacifica.approveBuilderCode(keypair, maxFeeRate.toString());

    return { success: result.success };
  }

  // Pacifica-specific: Withdraw funds
  async withdraw(auth: AuthContext, amount: string): Promise<{ success: boolean }> {
    const keypair = this.extractKeypair(auth);

    // Pacifica.withdraw takes (keypair, amount as string)
    const result = await Pacifica.withdraw(keypair, amount);

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

  private inferOrderStatus(order: any): Order['status'] {
    const initialAmount = parseFloat(order.initial_amount);
    const filledAmount = parseFloat(order.filled_amount);
    const cancelledAmount = parseFloat(order.cancelled_amount || '0');

    if (filledAmount === initialAmount) {
      return 'FILLED';
    } else if (filledAmount > 0) {
      return 'PARTIALLY_FILLED';
    } else if (cancelledAmount > 0) {
      return 'CANCELLED';
    }
    return 'OPEN';
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
