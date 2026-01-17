import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createLogger } from '@tfc/logger';
import { LOG_EVENTS } from '@tfc/shared';
import { PacificaSigningService } from './pacifica-signing.service.js';
import type * as nacl from 'tweetnacl';

const logger = createLogger({ service: 'api' });

interface PacificaResponse<T> {
  success: boolean;
  data: T;
  error: string | null;
  code: number | null;
}

/**
 * Pacifica API client service
 * @see Pacifica-API.md
 */
@Injectable()
export class PacificaService {
  private readonly apiUrl: string;
  private readonly builderCode: string;
  private readonly apiKey?: string;

  constructor(
    private readonly config: ConfigService,
    private readonly signing: PacificaSigningService
  ) {
    this.apiUrl = this.config.get<string>('PACIFICA_API_URL') || 'https://api.pacifica.fi';
    this.builderCode = this.config.get<string>('PACIFICA_BUILDER_CODE') || '';
    this.apiKey = this.config.get<string>('PACIFICA_API_KEY');
  }

  private getHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    };

    if (this.apiKey) {
      headers['PF-API-KEY'] = this.apiKey;
    }

    return headers;
  }

  private async request<T>(
    method: 'GET' | 'POST',
    endpoint: string,
    body?: Record<string, unknown>
  ): Promise<T> {
    const url = `${this.apiUrl}${endpoint}`;

    try {
      const response = await fetch(url, {
        method,
        headers: this.getHeaders(),
        body: body ? JSON.stringify(body) : undefined,
      });

      if (response.status === 429) {
        logger.warn(LOG_EVENTS.PACIFICA_API_RATE_LIMITED, 'Pacifica API rate limited', {
          endpoint,
        });
        throw new HttpException('Rate limited', HttpStatus.TOO_MANY_REQUESTS);
      }

      const data = (await response.json()) as PacificaResponse<T>;

      if (!response.ok || !data.success) {
        throw new HttpException(
          data.error || 'Pacifica API error',
          response.status || HttpStatus.BAD_REQUEST
        );
      }

      return data.data;
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }

      logger.error(LOG_EVENTS.PACIFICA_API_RATE_LIMITED, 'Pacifica API request failed', error as Error, {
        endpoint,
        method,
      });

      throw new HttpException('Pacifica API unavailable', HttpStatus.SERVICE_UNAVAILABLE);
    }
  }

  // ─────────────────────────────────────────────────────────────
  // Public Market Data (no auth required)
  // ─────────────────────────────────────────────────────────────

  /**
   * Get all market info
   * GET /api/v1/info
   */
  async getMarkets(): Promise<MarketInfo[]> {
    return this.request<MarketInfo[]>('GET', '/api/v1/info');
  }

  /**
   * Get all market prices
   * GET /api/v1/info/prices
   */
  async getPrices(): Promise<MarketPrice[]> {
    return this.request<MarketPrice[]>('GET', '/api/v1/info/prices');
  }

  /**
   * Get orderbook for a symbol
   * GET /api/v1/book?symbol=...
   */
  async getOrderbook(symbol: string, aggLevel = 1): Promise<OrderbookResponse> {
    return this.request<OrderbookResponse>('GET', `/api/v1/book?symbol=${symbol}&agg_level=${aggLevel}`);
  }

  /**
   * Get historical candles
   * GET /api/v1/kline
   */
  async getKlines(params: {
    symbol: string;
    interval: string;
    startTime: number;
    endTime?: number;
  }): Promise<Candle[]> {
    let url = `/api/v1/kline?symbol=${params.symbol}&interval=${params.interval}&start_time=${params.startTime}`;

    if (params.endTime) {
      url += `&end_time=${params.endTime}`;
    }

    return this.request<Candle[]>('GET', url);
  }

  /**
   * Get recent trades for a symbol
   * GET /api/v1/trades?symbol=...
   */
  async getRecentTrades(symbol: string): Promise<RecentTrade[]> {
    return this.request<RecentTrade[]>('GET', `/api/v1/trades?symbol=${symbol}`);
  }

  // ─────────────────────────────────────────────────────────────
  // Account Data (requires account address)
  // ─────────────────────────────────────────────────────────────

  /**
   * Get account info
   * GET /api/v1/account?account=...
   * Returns a single AccountInfo object (not an array)
   */
  async getAccount(accountAddress: string): Promise<AccountInfo> {
    return this.request<AccountInfo>('GET', `/api/v1/account?account=${accountAddress}`);
  }

  /**
   * Get positions for an account
   * GET /api/v1/positions?account=...
   */
  async getPositions(accountAddress: string): Promise<Position[]> {
    return this.request<Position[]>('GET', `/api/v1/positions?account=${accountAddress}`);
  }

  /**
   * Get open orders for an account
   * GET /api/v1/orders?account=...
   */
  async getOpenOrders(accountAddress: string): Promise<OpenOrder[]> {
    return this.request<OpenOrder[]>('GET', `/api/v1/orders?account=${accountAddress}`);
  }

  /**
   * Get trade history (fills) for an account
   * GET /api/v1/trades/history?account=...
   */
  async getTradeHistory(params: {
    accountAddress: string;
    symbol?: string;
    startTime?: number;
    endTime?: number;
    limit?: number;
  }): Promise<TradeHistoryResponse> {
    let url = `/api/v1/trades/history?account=${params.accountAddress}`;

    if (params.symbol) url += `&symbol=${params.symbol}`;
    if (params.startTime) url += `&start_time=${params.startTime}`;
    if (params.endTime) url += `&end_time=${params.endTime}`;
    if (params.limit) url += `&limit=${params.limit}`;

    return this.request<TradeHistoryResponse>('GET', url);
  }

  /**
   * Get account settings (leverage per symbol)
   * GET /api/v1/account/settings?account=...
   */
  async getAccountSettings(accountAddress: string): Promise<AccountSetting[]> {
    return this.request<AccountSetting[]>('GET', `/api/v1/account/settings?account=${accountAddress}`);
  }

  // ─────────────────────────────────────────────────────────────
  // Trading (requires signing)
  // ─────────────────────────────────────────────────────────────

  /**
   * Create a market order
   * POST /api/v1/orders/create_market
   */
  async createMarketOrder(
    keypair: nacl.SignKeyPair,
    params: {
      symbol: string;
      amount: string;
      side: 'bid' | 'ask';
      slippagePercent: string;
      reduceOnly: boolean;
      clientOrderId?: string;
    }
  ): Promise<{ order_id: number }> {
    const signedPayload = this.signing.signMarketOrder(keypair, {
      ...params,
      builderCode: this.builderCode,
    });

    return this.request<{ order_id: number }>('POST', '/api/v1/orders/create_market', signedPayload);
  }

  /**
   * Create a limit order
   * POST /api/v1/orders/create
   */
  async createLimitOrder(
    keypair: nacl.SignKeyPair,
    params: {
      symbol: string;
      price: string;
      amount: string;
      side: 'bid' | 'ask';
      tif: 'GTC' | 'IOC' | 'ALO' | 'TOB';
      reduceOnly: boolean;
      clientOrderId?: string;
    }
  ): Promise<{ order_id: number }> {
    const signedPayload = this.signing.signLimitOrder(keypair, {
      ...params,
      builderCode: this.builderCode,
    });

    return this.request<{ order_id: number }>('POST', '/api/v1/orders/create', signedPayload);
  }

  /**
   * Cancel an order
   * POST /api/v1/orders/cancel
   */
  async cancelOrder(
    keypair: nacl.SignKeyPair,
    params: {
      symbol: string;
      orderId?: number;
      clientOrderId?: string;
    }
  ): Promise<{ success: boolean }> {
    const signedPayload = this.signing.signCancelOrder(keypair, params);

    return this.request<{ success: boolean }>('POST', '/api/v1/orders/cancel', signedPayload);
  }

  /**
   * Cancel all orders
   * POST /api/v1/orders/cancel_all
   */
  async cancelAllOrders(
    keypair: nacl.SignKeyPair,
    params: {
      allSymbols: boolean;
      excludeReduceOnly: boolean;
      symbol?: string;
    }
  ): Promise<{ cancelled_count: number }> {
    const signedPayload = this.signing.signCancelAllOrders(keypair, params);

    return this.request<{ cancelled_count: number }>('POST', '/api/v1/orders/cancel_all', signedPayload);
  }

  /**
   * Update leverage for a symbol
   * POST /api/v1/account/leverage
   */
  async updateLeverage(
    keypair: nacl.SignKeyPair,
    params: {
      symbol: string;
      leverage: number;
    }
  ): Promise<{ success: boolean }> {
    const signedPayload = this.signing.signUpdateLeverage(keypair, params);

    return this.request<{ success: boolean }>('POST', '/api/v1/account/leverage', signedPayload);
  }

  /**
   * Approve builder code
   * POST /api/v1/account/builder_codes/approve
   */
  async approveBuilderCode(
    keypair: nacl.SignKeyPair,
    maxFeeRate = '0.001'
  ): Promise<{ success: boolean }> {
    const signedPayload = this.signing.signBuilderCodeApproval(keypair, this.builderCode, maxFeeRate);

    return this.request<{ success: boolean }>('POST', '/api/v1/account/builder_codes/approve', signedPayload);
  }

  /**
   * Check builder code approvals
   * GET /api/v1/account/builder_codes/approvals?account=...
   */
  async getBuilderCodeApprovals(accountAddress: string): Promise<BuilderCodeApproval[]> {
    return this.request<BuilderCodeApproval[]>(
      'GET',
      `/api/v1/account/builder_codes/approvals?account=${accountAddress}`
    );
  }
}

// ─────────────────────────────────────────────────────────────
// Response Types (exported for use in other modules)
// ─────────────────────────────────────────────────────────────

export interface MarketInfo {
  symbol: string;
  tick_size: string;
  min_tick: string;
  max_tick: string;
  lot_size: string;
  max_leverage: number;
  isolated_only: boolean;
  min_order_size: string;
  max_order_size: string;
  funding_rate: string;
  next_funding_rate: string;
  created_at: number;
}

export interface MarketPrice {
  symbol: string;
  funding: string;
  mark: string;
  mid: string;
  next_funding: string;
  open_interest: string;
  oracle: string;
  timestamp: number;
  volume_24h: string;
  yesterday_price: string;
}

export interface OrderbookResponse {
  s: string;
  l: Array<Array<{ p: string; a: string; n: number }>>;
  t: number;
}

export interface Candle {
  t: number;
  T: number;
  s: string;
  i: string;
  o: string;
  c: string;
  h: string;
  l: string;
  v: string;
  n: number;
}

export interface RecentTrade {
  event_type: string;
  price: string;
  amount: string;
  side: string;
  cause: string;
  created_at: number;
}

export interface AccountInfo {
  balance: string;
  fee_level: number;
  account_equity: string;
  available_to_spend: string;
  available_to_withdraw: string;
  pending_balance: string;
  total_margin_used: string;
  cross_mmr: string;
  positions_count: number;
  orders_count: number;
  stop_orders_count: number;
  updated_at: number;
  use_ltp_for_stop_orders: boolean;
}

export interface Position {
  symbol: string;
  side: string;
  amount: string;
  entry_price: string;
  margin: string;
  funding: string;
  isolated: boolean;
  created_at: number;
  updated_at: number;
}

export interface OpenOrder {
  order_id: number;
  client_order_id: string | null;
  symbol: string;
  side: string;
  price: string;
  initial_amount: string;
  filled_amount: string;
  cancelled_amount: string;
  stop_price: string | null;
  order_type: string;
  stop_parent_order_id: number | null;
  reduce_only: boolean;
  created_at: number;
  updated_at: number;
}

export interface TradeHistoryResponse {
  history_id: number;
  order_id: number;
  client_order_id: string | null;
  symbol: string;
  amount: string;
  price: string;
  entry_price: string;
  fee: string;
  pnl: string | null;
  event_type: string;
  side: string;
  created_at: number;
  cause: string;
}

export interface AccountSetting {
  symbol: string;
  isolated: boolean;
  leverage: number;
  created_at: number;
  updated_at: number;
}

interface BuilderCodeApproval {
  builder_code: string;
  description: string;
  max_fee_rate: string;
  updated_at: number;
}
