/**
 * Nado Exchange Adapter
 *
 * Implements the ExchangeAdapter interface for Nado DEX on Ink (L2).
 *
 * Key differences from other adapters:
 * - x18 fixed-point encoding for all prices/amounts
 * - Subaccount model (bytes32 = 20-byte address + 12-byte name)
 * - Product-based (product_id) instead of symbol-based
 * - Three separate services: Gateway (queries/executes), Archive (history), Trigger (TP/SL)
 * - Signing uses EIP-712 with linked signer (similar to HL agent wallet)
 */

import type {
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
  TradeHistoryItem,
  OrderHistoryItem,
  OrderHistoryStatus,
  AccountSetting,
  MarketOrderParams,
  LimitOrderParams,
  StopOrderParams,
  CancelOrderParams,
  CancelAllOrdersParams,
  KlineParams,
  TradeHistoryParams,
} from './adapter';
import { RateLimitError, ServiceUnavailableError } from '@/lib/server/errors';
import { addressToSubaccount, subaccountToAddress } from '@/lib/nado-utils';

// Re-export so existing consumers (order-router, etc.) keep working
export { addressToSubaccount, subaccountToAddress };

// ─────────────────────────────────────────────────────────────
// Debug logger (silent in production)
// ─────────────────────────────────────────────────────────────

const DEBUG = process.env.NODE_ENV !== 'production';
function debugLog(...args: unknown[]) {
  if (DEBUG) console.log('[NadoAdapter]', ...args);
}

// ─────────────────────────────────────────────────────────────
// Nado centralized configuration
// ─────────────────────────────────────────────────────────────

export const NADO_CONFIG = {
  gatewayUrl: process.env.NADO_GATEWAY_URL || 'https://gateway.test.nado.xyz/v1',
  archiveUrl: process.env.NADO_ARCHIVE_URL || 'https://archive.test.nado.xyz/v1',
  triggerUrl: process.env.NADO_TRIGGER_URL || 'https://trigger.test.nado.xyz/v1',
  chainId: parseInt(process.env.NADO_CHAIN_ID || '763373', 10),
  // Builder Code — earns fees on all trades routed through TFC
  // Register at https://tally.so/r/0QO4oy to get your builder ID
  builderId: parseInt(process.env.NADO_BUILDER_ID || '0', 10),
  // Fee rate in 0.1bps units (e.g. 10 = 1bps = 0.01%)
  builderFeeRate: parseInt(process.env.NADO_BUILDER_FEE_RATE || '0', 10),
} as const;

// ─────────────────────────────────────────────────────────────
// x18 fixed-point helpers
// ─────────────────────────────────────────────────────────────

const X18 = BigInt(10) ** BigInt(18);

/** Convert a human-readable number to x18 string. */
export function toX18(value: number): string {
  // Use 1e8 intermediate to avoid floating-point precision loss
  return (BigInt(Math.round(value * 1e8)) * BigInt(10) ** BigInt(10)).toString();
}

/** Convert an x18 string to a human-readable number. */
export function fromX18(x18: string): number {
  return Number(BigInt(x18)) / Number(X18);
}

/**
 * Generate the verifying contract for order signing.
 * Product ID is zero-padded to 20-byte address format.
 */
export function genOrderVerifyingContract(productId: number): string {
  return '0x' + productId.toString(16).padStart(40, '0');
}

/**
 * Generate a nonce: upper 44 bits = discard time ms, lower 20 bits = random.
 */
export function generateNonce(): string {
  const discardTime = BigInt(Date.now() + 10_000); // 10 seconds for signing + network latency
  const random = BigInt(Math.floor(Math.random() * 1000000));
  return ((discardTime << BigInt(20)) + random).toString();
}

/**
 * Encode the 128-bit appendix for an order.
 */
export function encodeAppendix(opts: {
  orderType?: 'DEFAULT' | 'IOC' | 'FOK' | 'POST_ONLY';
  reduceOnly?: boolean;
  triggerType?: 'NONE' | 'PRICE' | 'TWAP';
  isolated?: boolean;
  builderFee?: number;
  builderId?: number;
}): string {
  let value = BigInt(1); // version = 1

  if (opts.isolated) value |= BigInt(1) << BigInt(8);

  const orderTypeMap = { DEFAULT: 0, IOC: 1, FOK: 2, POST_ONLY: 3 };
  const ot = opts.orderType ? orderTypeMap[opts.orderType] : 0;
  value |= BigInt(ot) << BigInt(9);

  if (opts.reduceOnly) value |= BigInt(1) << BigInt(11);

  const triggerMap = { NONE: 0, PRICE: 1, TWAP: 2 };
  const tt = opts.triggerType ? triggerMap[opts.triggerType] : 0;
  value |= BigInt(tt) << BigInt(12);

  // Builder Code: use explicit params or fall back to env config
  const feeRate = opts.builderFee ?? NADO_CONFIG.builderFeeRate;
  const builderId = opts.builderId ?? NADO_CONFIG.builderId;
  if (feeRate) value |= BigInt(feeRate & 0x3ff) << BigInt(38);
  if (builderId) value |= BigInt(builderId & 0xffff) << BigInt(48);

  return value.toString();
}

// ─────────────────────────────────────────────────────────────
// Nado API response types
// ─────────────────────────────────────────────────────────────

interface NadoProduct {
  product_id: number;
  // Spot products
  token_addr?: string;
  // Perp products
  oracle_price_x18?: string;
  // Book info (present on all)
  book_info?: {
    size_increment: string;
    price_increment_x18: string;
    min_size: string;
  };
  // Risk parameters
  long_weight_initial_x18?: string;
  short_weight_initial_x18?: string;
  long_weight_maintenance_x18?: string;
  short_weight_maintenance_x18?: string;
  max_leverage?: number;
  // Funding
  funding_rate_x18?: string;
  cumulative_funding_x18?: string;
  open_interest_x18?: string;
  // For symbol resolution
  symbol?: string;
}

interface NadoSubaccountInfo {
  exists: boolean;
  // healths is an array: [initial, maintenance, unweighted]
  healths: Array<{ assets: string; liabilities: string; health: string }>;
  spot_balances: Array<{
    product_id: number;
    balance: { amount: string };
  }>;
  perp_balances: Array<{
    product_id: number;
    balance: {
      amount: string;
      v_quote_balance: string;
      last_cumulative_funding_x18: string;
    };
  }>;
}

interface NadoOpenOrder {
  digest: string;
  product_id: number;
  sender: string;
  price_x18: string;
  amount: string;
  unfilled_amount: string;
  expiration: string;
  nonce: string;
  appendix: string;
  order_type: string; // "default", "ioc", "fok", "post_only"
  placed_at: number;
  id: number;
}

interface NadoArchiveOrder {
  digest: string;
  product_id: number;
  subaccount: string;
  amount: string;
  price_x18: string;
  base_filled: string;
  quote_filled: string;
  fee: string;
  builder_fee: string;
  realized_pnl: string;
  first_fill_timestamp: string;
  last_fill_timestamp: string;
  expiration: string;
  nonce: string;
  appendix: string;
  submission_idx: string;
}

interface NadoArchiveMatch {
  digest: string;
  order: {
    sender: string;
    priceX18: string;
    amount: string;
  };
  base_filled: string;
  quote_filled: string;
  fee: string;
  builder_fee: number | string;
  sequencer_fee: string;
  is_taker: boolean;
  pre_balance: {
    base: {
      perp?: { product_id: number };
      spot?: { product_id: number };
    } | null;
  };
  submission_idx: string;
}

// ─────────────────────────────────────────────────────────────
// Product / symbol cache
// ─────────────────────────────────────────────────────────────

interface NadoProductMeta {
  productId: number;
  symbol: string; // Native Nado format: "BTC-PERP"
  baseAsset: string; // "BTC"
  isPerp: boolean;
  oraclePrice: number;
  sizeIncrement: number;
  priceIncrement: number;
  minSize: number;
  maxLeverage: number;
  fundingRate: number;
  openInterest: number;
  cumulativeFundingLong: number; // Current cumulative funding index for longs
  cumulativeFundingShort: number; // Current cumulative funding index for shorts
}

let productCache: NadoProductMeta[] = [];
let productCacheLoaded = false;
let productCacheTime = 0;
const PRODUCT_CACHE_TTL = 5 * 60 * 1000; // 5 minutes
let productByIdMap = new Map<number, NadoProductMeta>();
let productBySymbolMap = new Map<string, NadoProductMeta>();
let endpointAddr: string = '';

// ─────────────────────────────────────────────────────────────
// API helpers
// ─────────────────────────────────────────────────────────────

const NADO_MIN_REQUEST_GAP_MS = 50;
let nadoLastRequestTime = 0;
let nadoRequestQueue: Promise<void> = Promise.resolve();

export async function nadoQuery<T>(body: Record<string, unknown>): Promise<T> {
  const result = new Promise<T>((resolve, reject) => {
    nadoRequestQueue = nadoRequestQueue.then(async () => {
      const now = Date.now();
      const elapsed = now - nadoLastRequestTime;
      if (elapsed < NADO_MIN_REQUEST_GAP_MS) {
        await new Promise((r) => setTimeout(r, NADO_MIN_REQUEST_GAP_MS - elapsed));
      }
      nadoLastRequestTime = Date.now();

      const url = `${NADO_CONFIG.gatewayUrl}/query`;
      try {
        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept-Encoding': 'gzip, deflate, br',
          },
          body: JSON.stringify(body),
          signal: AbortSignal.timeout(15000),
        });

        if (!response.ok) {
          const text = await response.text();
          console.error(`[NadoAdapter] HTTP ${response.status} from ${url}:`, text.slice(0, 200));
          if (response.status === 429) {
            reject(new RateLimitError('Nado API rate limited'));
            return;
          }
          reject(new ServiceUnavailableError(`Nado API error (${response.status}): ${text}`));
          return;
        }

        resolve(response.json());
      } catch (err) {
        console.error(`[NadoAdapter] Fetch error for ${url}:`, err);
        reject(err);
      }
    });
  });

  return result;
}

const NADO_ARCHIVE_MIN_GAP_MS = 100;
let nadoArchiveLastTime = 0;
let nadoArchiveQueue: Promise<void> = Promise.resolve();

async function nadoArchive<T>(body: Record<string, unknown>): Promise<T> {
  const result = new Promise<T>((resolve, reject) => {
    nadoArchiveQueue = nadoArchiveQueue.then(async () => {
      const now = Date.now();
      const elapsed = now - nadoArchiveLastTime;
      if (elapsed < NADO_ARCHIVE_MIN_GAP_MS) {
        await new Promise((r) => setTimeout(r, NADO_ARCHIVE_MIN_GAP_MS - elapsed));
      }
      nadoArchiveLastTime = Date.now();

      const url = NADO_CONFIG.archiveUrl;
      try {
        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept-Encoding': 'gzip, deflate, br',
          },
          body: JSON.stringify(body),
          signal: AbortSignal.timeout(15000),
        });

        if (!response.ok) {
          const text = await response.text();
          console.error(`[NadoAdapter] HTTP ${response.status} from ${url}:`, text.slice(0, 200));
          if (response.status === 429) {
            reject(new RateLimitError('Nado Archive API rate limited'));
            return;
          }
          reject(
            new ServiceUnavailableError(
              `Nado Archive error (${response.status}): ${text.slice(0, 200)}`
            )
          );
          return;
        }

        resolve(response.json());
      } catch (err) {
        console.error(`[NadoAdapter] Archive fetch error for ${url}:`, err);
        reject(err);
      }
    });
  });

  return result;
}

// ─────────────────────────────────────────────────────────────
// Adapter implementation
// ─────────────────────────────────────────────────────────────

export class NadoAdapter implements ExchangeAdapter {
  readonly name = 'nado';
  readonly version = 'v1';

  /** Load all products and contracts using the `symbols` endpoint, with TTL-based refresh. */
  private async ensureProducts(): Promise<void> {
    const now = Date.now();
    if (productCacheLoaded && now - productCacheTime < PRODUCT_CACHE_TTL) return;

    const [symbolsResult, contracts] = await Promise.all([
      nadoQuery<{
        data: {
          symbols: Record<
            string,
            {
              type: string;
              product_id: number;
              symbol: string;
              price_increment_x18: string;
              size_increment: string;
              min_size: string;
              maker_fee_rate_x18: string;
              taker_fee_rate_x18: string;
              long_weight_initial_x18: string;
              long_weight_maintenance_x18: string;
              max_open_interest_x18: string | null;
              trading_status: string;
            }
          >;
        };
      }>({ type: 'symbols' }),
      nadoQuery<{ data: { chain_id: string; endpoint_addr: string } }>({
        type: 'contracts',
      }),
    ]);

    endpointAddr = contracts.data.endpoint_addr;

    const products: NadoProductMeta[] = [];
    const perpProductIds: number[] = [];

    for (const [, info] of Object.entries(symbolsResult.data.symbols)) {
      if (info.type !== 'perp') continue;
      if (info.trading_status !== 'live') continue;

      // Keep native Nado symbol format: "BTC-PERP", "ETH-PERP"
      const symbol = info.symbol;
      const baseAsset = symbol.replace('-PERP', '');

      // Derive max leverage from initial weight: leverage = 1 / (1 - longWeightInitial)
      const longWeightInit = fromX18(info.long_weight_initial_x18);
      const maxLeverage = longWeightInit < 1 ? Math.round(1 / (1 - longWeightInit)) : 20;

      perpProductIds.push(info.product_id);
      products.push({
        productId: info.product_id,
        symbol,
        baseAsset,
        isPerp: true,
        oraclePrice: 0,
        sizeIncrement: fromX18(info.size_increment),
        priceIncrement: fromX18(info.price_increment_x18),
        minSize: fromX18(info.min_size),
        maxLeverage,
        fundingRate: 0,
        openInterest: 0,
        cumulativeFundingLong: 0,
        cumulativeFundingShort: 0,
      });
    }

    // Fetch oracle prices and open interest from all_products
    try {
      const allProds = await nadoQuery<{
        data: {
          perp_products: Array<{
            product_id: number;
            oracle_price_x18: string;
            state: {
              open_interest: string;
              cumulative_funding_long_x18: string;
              cumulative_funding_short_x18: string;
            };
          }>;
        };
      }>({ type: 'all_products' });

      for (const pp of allProds.data.perp_products || []) {
        const product = products.find((p) => p.productId === pp.product_id);
        if (product) {
          product.oraclePrice = fromX18(pp.oracle_price_x18);
          product.openInterest = fromX18(pp.state.open_interest);
          product.cumulativeFundingLong = fromX18(pp.state.cumulative_funding_long_x18);
          product.cumulativeFundingShort = fromX18(pp.state.cumulative_funding_short_x18);
        }
      }
    } catch (err) {
      debugLog('Failed to fetch all_products:', err);
    }

    productCache = products;
    productCacheLoaded = true;
    productCacheTime = Date.now();

    // Populate lookup Maps for O(1) access
    productByIdMap = new Map();
    productBySymbolMap = new Map();
    for (const p of products) {
      productByIdMap.set(p.productId, p);
      productBySymbolMap.set(p.symbol, p);
    }
  }

  /** Get product meta by symbol (native Nado format, e.g. "BTC-PERP") */
  private getProduct(symbol: string): NadoProductMeta {
    const product = productBySymbolMap.get(symbol);
    if (!product) throw new Error(`Unknown Nado symbol: ${symbol}`);
    return product;
  }

  /** Get product meta by product ID */
  private getProductById(productId: number): NadoProductMeta | undefined {
    return productByIdMap.get(productId);
  }

  // ─── Public Market Data ──────────────────────────────────────

  async getMarkets(): Promise<Market[]> {
    await this.ensureProducts();

    return productCache
      .filter((p) => p.isPerp)
      .map((p) => ({
        symbol: p.symbol,
        baseAsset: p.baseAsset,
        quoteAsset: 'USD',
        tickSize: p.priceIncrement.toString(),
        stepSize: p.sizeIncrement.toString(),
        minOrderSize: p.minSize.toString(),
        maxOrderSize: '1000000',
        minNotional: (p.minSize * p.oraclePrice).toString(),
        maxLeverage: p.maxLeverage,
        fundingRate: p.fundingRate.toString(),
        fundingInterval: 1,
        metadata: {
          productId: p.productId,
        },
      }));
  }

  async getPrices(): Promise<Price[]> {
    await this.ensureProducts();

    const productIds = productCache.filter((p) => p.isPerp).map((p) => p.productId);
    if (productIds.length === 0) return [];

    const result = await nadoQuery<{
      data: {
        market_prices: Array<{
          product_id: number;
          bid_x18: string;
          ask_x18: string;
        }>;
      };
    }>({
      type: 'market_prices',
      product_ids: productIds,
    });

    return (result.data.market_prices || [])
      .map((mp) => {
        const product = this.getProductById(mp.product_id);
        if (!product) return null;

        const bid = fromX18(mp.bid_x18);
        const ask = fromX18(mp.ask_x18);
        const mid = (bid + ask) / 2;

        return {
          symbol: product.symbol,
          mark: mid.toString(),
          index: product.oraclePrice.toString(),
          last: mid.toString(),
          bid: bid.toString(),
          ask: ask.toString(),
          funding: product.fundingRate.toString(),
          volume24h: '0', // Not available from market_prices
          change24h: '0',
          timestamp: Date.now(),
        };
      })
      .filter(Boolean) as Price[];
  }

  async getOrderbook(symbol: string, _aggLevel?: number): Promise<Orderbook> {
    await this.ensureProducts();
    const product = this.getProduct(symbol);

    const result = await nadoQuery<{
      data: {
        product_id: number;
        bids: [string, string][];
        asks: [string, string][];
        timestamp: string;
      };
    }>({
      type: 'market_liquidity',
      product_id: product.productId,
      depth: 20,
    });

    const bids: [string, string][] = (result.data.bids || []).map(
      ([priceX18, qtyX18]) =>
        [fromX18(priceX18).toString(), fromX18(qtyX18).toString()] as [string, string]
    );
    const asks: [string, string][] = (result.data.asks || []).map(
      ([priceX18, qtyX18]) =>
        [fromX18(priceX18).toString(), fromX18(qtyX18).toString()] as [string, string]
    );

    return {
      symbol,
      bids,
      asks,
      timestamp: Date.now(),
    };
  }

  async getKlines(params: KlineParams): Promise<Candle[]> {
    await this.ensureProducts();
    const product = this.getProduct(params.symbol);

    // Map TFC interval to Nado granularity (seconds)
    const granularityMap: Record<string, number> = {
      '1m': 60,
      '5m': 300,
      '15m': 900,
      '1h': 3600,
      '2h': 7200,
      '4h': 14400,
      '1d': 86400,
      '1w': 604800,
    };
    const granularity = granularityMap[params.interval] || 3600;

    const archiveParams: Record<string, unknown> = {
      candlesticks: {
        product_id: product.productId,
        granularity,
        limit: params.limit || 500,
      },
    };

    if (params.endTime) {
      (archiveParams.candlesticks as Record<string, unknown>).max_time = Math.floor(
        params.endTime / 1000
      );
    }

    const result = await nadoArchive<{
      candlesticks: Array<{
        open_x18: string;
        high_x18: string;
        low_x18: string;
        close_x18: string;
        volume: string;
        timestamp: string;
      }>;
    }>(archiveParams);

    return (result.candlesticks || []).map((c) => ({
      timestamp: parseInt(c.timestamp) * 1000, // Convert to ms
      open: fromX18(c.open_x18).toString(),
      high: fromX18(c.high_x18).toString(),
      low: fromX18(c.low_x18).toString(),
      close: fromX18(c.close_x18).toString(),
      volume: c.volume ? fromX18(c.volume).toString() : '0',
    }));
  }

  async getRecentTrades(symbol: string): Promise<RecentTrade[]> {
    // Nado doesn't have a public recent trades REST endpoint
    // Real-time trades come from the WS `trade` stream
    debugLog(`getRecentTrades not supported via REST for ${symbol}`);
    return [];
  }

  // ─── Account Data ──────────────────────────────────────────

  async getAccount(accountId: string): Promise<Account> {
    await this.ensureProducts();

    // accountId can be a wallet address or full subaccount bytes32
    const subaccount = accountId.length === 66 ? accountId : addressToSubaccount(accountId);

    const result = await nadoQuery<{ data: NadoSubaccountInfo }>({
      type: 'subaccount_info',
      subaccount,
    });

    const info = result.data;
    if (!info.exists) {
      return {
        accountId,
        balance: '0',
        accountEquity: '0',
        availableToSpend: '0',
        marginUsed: '0',
        unrealizedPnl: '0',
        makerFee: '0.0002',
        takerFee: '0.0005',
        metadata: { exists: false },
      };
    }

    // healths is array: [initial, maintenance, unweighted]
    const initialHealth = info.healths[0] || { assets: '0', liabilities: '0', health: '0' };
    const unweightedHealth = info.healths[2] || { assets: '0', liabilities: '0', health: '0' };
    const equity = fromX18(unweightedHealth.assets);
    const health = fromX18(initialHealth.health);
    const marginUsed = Math.max(0, equity - health);

    // Spot balance for USDT0 (product_id 0) is the collateral
    const usdtBalance = info.spot_balances.find((b) => b.product_id === 0);
    const balance = usdtBalance ? fromX18(usdtBalance.balance.amount) : 0;

    // Calculate unrealized PnL from perp balances
    let unrealizedPnl = 0;
    for (const pb of info.perp_balances) {
      const amount = fromX18(pb.balance.amount);
      if (amount === 0) continue;
      const product = this.getProductById(pb.product_id);
      if (!product) continue;
      const vQuote = fromX18(pb.balance.v_quote_balance);
      // PnL = amount * oraclePrice + vQuoteBalance
      unrealizedPnl += amount * product.oraclePrice + vQuote;
    }

    return {
      accountId,
      balance: balance.toFixed(6),
      accountEquity: equity.toFixed(6),
      availableToSpend: Math.max(0, health).toFixed(6),
      marginUsed: marginUsed.toFixed(6),
      unrealizedPnl: unrealizedPnl.toFixed(6),
      makerFee: '0.0002',
      takerFee: '0.0005',
      metadata: {
        subaccount,
        healths: info.healths,
      },
    };
  }

  async getPositions(accountId: string): Promise<Position[]> {
    await this.ensureProducts();

    const subaccount = accountId.length === 66 ? accountId : addressToSubaccount(accountId);

    const result = await nadoQuery<{ data: NadoSubaccountInfo }>({
      type: 'subaccount_info',
      subaccount,
    });

    if (!result.data.exists) return [];

    return result.data.perp_balances
      .filter((pb) => fromX18(pb.balance.amount) !== 0)
      .map((pb) => {
        const amount = fromX18(pb.balance.amount);
        const isLong = amount > 0;
        const product = this.getProductById(pb.product_id);
        if (!product) return null;

        const vQuote = fromX18(pb.balance.v_quote_balance);
        const entryPrice = amount !== 0 ? Math.abs(vQuote / amount) : 0;
        const oraclePrice = product.oraclePrice;
        const unrealizedPnl = amount * oraclePrice + vQuote;

        // Funding PnL = amount * (currentCumulativeFunding - positionCumulativeFunding)
        // Longs use cumulativeFundingLong, shorts use cumulativeFundingShort
        const lastCumFunding = fromX18(pb.balance.last_cumulative_funding_x18);
        const currentCumFunding = isLong
          ? product.cumulativeFundingLong
          : product.cumulativeFundingShort;
        const fundingPnl = amount * (currentCumFunding - lastCumFunding);

        // Compute position notional, leverage, margin, and liquidation price
        const positionNotional = Math.abs(amount) * oraclePrice;
        const maxLev = product.maxLeverage || 1;
        // Estimate margin as notional / maxLeverage (position uses max available leverage)
        const margin = positionNotional > 0 ? positionNotional / maxLev : 0;
        // Effective leverage = notional / margin
        const leverage = margin > 0 ? positionNotional / margin : 1;
        // Approximate liquidation price:
        //   Long: entryPrice * (1 - 1/leverage)
        //   Short: entryPrice * (1 + 1/leverage)
        let liquidationPrice = 0;
        if (entryPrice > 0 && leverage > 1) {
          liquidationPrice = isLong
            ? entryPrice * (1 - 1 / leverage)
            : entryPrice * (1 + 1 / leverage);
          liquidationPrice = Math.max(0, liquidationPrice);
        }

        return {
          symbol: product.symbol,
          side: (isLong ? 'LONG' : 'SHORT') as 'LONG' | 'SHORT',
          amount: Math.abs(amount).toString(),
          entryPrice: entryPrice.toFixed(6),
          markPrice: oraclePrice.toString(),
          margin: margin.toFixed(6),
          leverage: leverage.toFixed(2),
          unrealizedPnl: unrealizedPnl.toFixed(6),
          liquidationPrice: liquidationPrice.toFixed(6),
          funding: fundingPnl.toFixed(6),
          metadata: {
            productId: pb.product_id,
            vQuoteBalance: vQuote,
          },
        };
      })
      .filter(Boolean) as Position[];
  }

  async getOpenOrders(accountId: string): Promise<Order[]> {
    await this.ensureProducts();

    const subaccount = accountId.length === 66 ? accountId : addressToSubaccount(accountId);

    // subaccount_orders requires product_id — query all perp products
    const allOrders: NadoOpenOrder[] = [];
    const perpProducts = productCache.filter((p) => p.isPerp);

    // Query in parallel batches
    const results = await Promise.all(
      perpProducts.map((p) =>
        nadoQuery<{ data: { orders: NadoOpenOrder[] } }>({
          type: 'subaccount_orders',
          sender: subaccount,
          product_id: p.productId,
        }).catch(() => ({ data: { orders: [] } }))
      )
    );

    for (const r of results) {
      allOrders.push(...(r.data.orders || []));
    }

    return allOrders.map((o) => {
      const product = this.getProductById(o.product_id);
      const symbol = product?.symbol || `UNKNOWN-${o.product_id}`;
      const amount = fromX18(o.amount);
      const price = fromX18(o.price_x18);

      // Parse appendix for order type
      const appendix = BigInt(o.appendix);
      const orderTypeVal = Number((appendix >> BigInt(9)) & BigInt(3));
      const reduceOnly = ((appendix >> BigInt(11)) & BigInt(1)) === BigInt(1);
      const triggerType = Number((appendix >> BigInt(12)) & BigInt(3));

      let orderType: OrderType = 'LIMIT';
      if (triggerType > 0) {
        orderType = orderTypeVal === 1 ? 'STOP_MARKET' : 'STOP_LIMIT';
      } else if (orderTypeVal === 1) {
        orderType = 'MARKET';
      }

      return {
        orderId: o.digest,
        symbol,
        side: (amount > 0 ? 'BUY' : 'SELL') as OrderSide,
        type: orderType,
        price: price.toString(),
        amount: Math.abs(amount).toString(),
        filled: (Math.abs(amount) - Math.abs(fromX18(o.unfilled_amount))).toString(),
        remaining: Math.abs(fromX18(o.unfilled_amount)).toString(),
        status: 'OPEN' as const,
        timeInForce:
          (['GTC', 'IOC', 'FOK', 'POST_ONLY'] as const)[orderTypeVal] || ('GTC' as const),
        reduceOnly,
        createdAt: o.placed_at ? o.placed_at * 1000 : Date.now(),
        updatedAt: o.placed_at ? o.placed_at * 1000 : Date.now(),
        metadata: {
          digest: o.digest,
          productId: o.product_id,
          appendix: o.appendix,
        },
      };
    });
  }

  async getTradeHistory(params: TradeHistoryParams): Promise<TradeHistoryItem[]> {
    await this.ensureProducts();

    const subaccount =
      params.accountId.length === 66 ? params.accountId : addressToSubaccount(params.accountId);

    const archiveParams: Record<string, unknown> = {
      subaccounts: [subaccount],
      limit: params.limit || 100,
    };

    if (params.endTime) {
      archiveParams.max_time = Math.floor(params.endTime / 1000);
    }

    // If symbol specified, add product_id filter
    if (params.symbol) {
      const product = this.getProduct(params.symbol);
      archiveParams.product_ids = [product.productId];
    }

    const result = await nadoArchive<{
      matches: NadoArchiveMatch[];
    }>({
      matches: archiveParams,
    });

    return (result.matches || []).map((m) => {
      // Extract product_id from pre_balance
      const productId =
        m.pre_balance?.base?.perp?.product_id ?? m.pre_balance?.base?.spot?.product_id ?? 0;
      const product = this.getProductById(productId);
      const symbol = product?.symbol || `UNKNOWN-${productId}`;
      const baseFilled = fromX18(m.base_filled);
      const quoteFilled = fromX18(m.quote_filled);
      const price = baseFilled !== 0 ? Math.abs(quoteFilled / baseFilled) : 0;

      // Extract timestamp from submission_idx: upper 44 bits encode
      // milliseconds (same encoding as generateNonce — ms << 20 | seq)
      let executedAt = Date.now();
      if (m.submission_idx) {
        try {
          const idxBig = BigInt(m.submission_idx);
          const tsMs = Number(idxBig >> BigInt(20));
          if (tsMs > 1_000_000_000_000 && tsMs < 2_000_000_000_000) {
            executedAt = tsMs;
          }
        } catch {
          // Fall back to Date.now() if parsing fails
        }
      }

      return {
        historyId: m.submission_idx,
        orderId: m.digest,
        symbol,
        side: (baseFilled > 0 ? 'BUY' : 'SELL') as OrderSide,
        amount: Math.abs(baseFilled).toString(),
        price: price.toFixed(6),
        fee: fromX18(m.fee).toFixed(6),
        pnl: null,
        executedAt,
        metadata: {
          isTaker: m.is_taker,
          builderFee: Number(m.builder_fee),
          sequencerFee: fromX18(m.sequencer_fee),
        },
      };
    });
  }

  async getAccountSettings(accountId: string): Promise<AccountSetting[]> {
    // Nado doesn't have per-asset leverage settings like HL
    // Leverage is per-position via isolated margin flag in appendix
    await this.ensureProducts();
    return productCache
      .filter((p) => p.isPerp)
      .map((p) => ({
        symbol: p.symbol,
        leverage: p.maxLeverage,
        metadata: { productId: p.productId },
      }));
  }

  async getOrderHistory(accountId: string): Promise<OrderHistoryItem[]> {
    await this.ensureProducts();

    const subaccount = accountId.length === 66 ? accountId : addressToSubaccount(accountId);

    const result = await nadoArchive<{ orders: NadoArchiveOrder[] }>({
      orders: {
        subaccounts: [subaccount],
        limit: 100,
      },
    });

    return (result.orders || []).map((o) => {
      const product = this.getProductById(o.product_id);
      const symbol = product?.symbol || `UNKNOWN-${o.product_id}`;
      const amount = fromX18(o.amount);
      const baseFilled = fromX18(o.base_filled);
      const price = fromX18(o.price_x18);

      // Determine status from fill data
      let status: OrderHistoryStatus = 'filled';
      if (baseFilled === 0) {
        status = 'canceled';
      } else if (Math.abs(baseFilled) < Math.abs(amount)) {
        status = 'filled'; // Partially filled, treated as filled
      }

      // Parse appendix for order type
      const appendix = BigInt(o.appendix);
      const orderTypeVal = Number((appendix >> BigInt(9)) & BigInt(3));
      const reduceOnly = ((appendix >> BigInt(11)) & BigInt(1)) === BigInt(1);
      const triggerType = Number((appendix >> BigInt(12)) & BigInt(3));

      let orderType: OrderType = 'LIMIT';
      if (triggerType > 0) {
        orderType = orderTypeVal === 1 ? 'STOP_MARKET' : 'STOP_LIMIT';
      } else if (orderTypeVal === 1) {
        orderType = 'MARKET';
      }

      const lastFillTs = o.last_fill_timestamp
        ? parseInt(o.last_fill_timestamp) * 1000
        : Date.now();

      return {
        orderId: o.digest,
        symbol,
        side: (amount > 0 ? 'BUY' : 'SELL') as OrderSide,
        type: orderType,
        price: price.toString(),
        amount: Math.abs(amount).toString(),
        filled: Math.abs(baseFilled).toString(),
        status,
        reduceOnly,
        createdAt: o.first_fill_timestamp ? parseInt(o.first_fill_timestamp) * 1000 : Date.now(),
        statusTimestamp: lastFillTs,
        metadata: {
          digest: o.digest,
          productId: o.product_id,
          realizedPnl: fromX18(o.realized_pnl),
          fee: fromX18(o.fee),
        },
      };
    });
  }

  // ─── Trading Operations ────────────────────────────────────
  // These are handled by NadoOrderRouter (server-side signing).

  async createMarketOrder(
    _auth: AuthContext,
    _params: MarketOrderParams
  ): Promise<{ orderId: string | number }> {
    throw new Error('Use NadoOrderRouter for order operations (server-side signing)');
  }

  async createLimitOrder(
    _auth: AuthContext,
    _params: LimitOrderParams
  ): Promise<{ orderId: string | number }> {
    throw new Error('Use NadoOrderRouter for order operations (server-side signing)');
  }

  async createStopOrder(
    _auth: AuthContext,
    _params: StopOrderParams
  ): Promise<{ orderId: string | number }> {
    throw new Error('Use NadoOrderRouter for order operations (server-side signing)');
  }

  async cancelOrder(_auth: AuthContext, _params: CancelOrderParams): Promise<{ success: boolean }> {
    throw new Error('Use NadoOrderRouter for order operations (server-side signing)');
  }

  async cancelAllOrders(
    _auth: AuthContext,
    _params: CancelAllOrdersParams
  ): Promise<{ cancelledCount: number }> {
    throw new Error('Use NadoOrderRouter for order operations (server-side signing)');
  }

  async updateLeverage(
    _auth: AuthContext,
    _symbol: string,
    _leverage: number
  ): Promise<{ success: boolean }> {
    throw new Error('Use NadoOrderRouter for order operations (server-side signing)');
  }
}

// ─────────────────────────────────────────────────────────────
// Exported helpers for use by order router and WS adapter
// ─────────────────────────────────────────────────────────────

/** Get product ID for a symbol (native format, e.g. "BTC-PERP"). Loads products if not cached. */
export async function getNadoProductId(symbol: string): Promise<number> {
  if (!productCacheLoaded) {
    const adapter = new NadoAdapter();
    await adapter.getMarkets();
  }
  const product = productBySymbolMap.get(symbol);
  if (!product) throw new Error(`Unknown Nado symbol: ${symbol}`);
  return product.productId;
}

/** Get all product metadata (loaded state). */
export function getNadoProducts(): NadoProductMeta[] {
  return productCache;
}

/** Get the cached endpoint address. */
export function getNadoEndpointAddr(): string {
  return endpointAddr;
}

/** Get product metadata by symbol. */
export function getNadoProductMeta(symbol: string): NadoProductMeta | undefined {
  return productBySymbolMap.get(symbol);
}

/** Round a price to the product's tick size (price increment). */
export function roundToNadoTick(price: number, productId: number): number {
  const meta = productByIdMap.get(productId);
  if (!meta || meta.priceIncrement === 0) return price;
  return Math.round(price / meta.priceIncrement) * meta.priceIncrement;
}

/** Round an amount to the product's lot size (size increment). */
export function roundToNadoLot(amount: number, productId: number): number {
  const meta = productByIdMap.get(productId);
  if (!meta || meta.sizeIncrement === 0) return amount;
  return Math.round(amount / meta.sizeIncrement) * meta.sizeIncrement;
}

/** Invalidate product cache (for testing or refresh). */
export function invalidateNadoProductCache(): void {
  productCacheLoaded = false;
  productCacheTime = 0;
  productCache = [];
  productByIdMap = new Map();
  productBySymbolMap = new Map();
  endpointAddr = '';
}
