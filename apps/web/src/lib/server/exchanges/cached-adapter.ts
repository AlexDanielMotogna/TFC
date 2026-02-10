/**
 * Cached Exchange Adapter Wrapper
 * Adds Redis caching, request deduplication, and cache invalidation
 */

import Redis from 'ioredis';
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
 * Cached wrapper for any ExchangeAdapter
 * Adds Redis caching, request deduplication, and rate limiting
 */
export class CachedExchangeAdapter implements ExchangeAdapter {
  private adapter: ExchangeAdapter;
  private redis: Redis;
  private pendingRequests: Map<string, Promise<any>> = new Map();

  readonly name: string;
  readonly version: string;

  constructor(adapter: ExchangeAdapter, redisUrl: string) {
    this.adapter = adapter;

    // Configure Redis with connection timeout and TLS support
    this.redis = new Redis(redisUrl, {
      connectTimeout: 5000, // 5 second timeout
      maxRetriesPerRequest: 2,
      enableReadyCheck: false,
      lazyConnect: true, // Don't block on connection
      tls: redisUrl.startsWith('rediss://') ? {} : undefined, // Enable TLS for rediss://
    });

    this.name = adapter.name;
    this.version = adapter.version;

    // Handle Redis errors gracefully
    this.redis.on('error', (err) => {
      console.warn('[CachedAdapter] Redis error (will fallback to direct calls):', err.message);
    });

    // Attempt to connect without blocking
    this.redis.connect().catch((err) => {
      console.warn('[CachedAdapter] Redis connection failed (will fallback to direct calls):', err.message);
    });
  }

  // ─────────────────────────────────────────────────────────────
  // Public Market Data (Cached)
  // ─────────────────────────────────────────────────────────────

  async getMarkets(): Promise<Market[]> {
    return this.withCache(
      'markets:all',
      () => this.adapter.getMarkets(),
      300 // Cache for 5 minutes
    );
  }

  async getPrices(): Promise<Price[]> {
    return this.withCache(
      'prices:all',
      () => this.adapter.getPrices(),
      5 // Cache for 5 seconds (real-time data)
    );
  }

  async getOrderbook(symbol: string, aggLevel = 1): Promise<Orderbook> {
    return this.withCache(
      `orderbook:${symbol}:${aggLevel}`,
      () => this.adapter.getOrderbook(symbol, aggLevel),
      3 // Cache for 3 seconds
    );
  }

  async getKlines(params: KlineParams): Promise<Candle[]> {
    const cacheKey = `klines:${params.symbol}:${params.interval}:${params.startTime}:${params.endTime}`;

    // Use longer TTL for historical data (older than 1 day ago)
    const oneDayAgo = Date.now() - (24 * 60 * 60 * 1000);
    const isHistorical = params.endTime && params.endTime < oneDayAgo;
    const ttl = isHistorical ? 3600 : 60; // 1 hour for historical, 1 minute for recent

    return this.withCache(
      cacheKey,
      () => this.adapter.getKlines(params),
      ttl
    );
  }

  async getRecentTrades(symbol: string): Promise<RecentTrade[]> {
    return this.withCache(
      `trades:recent:${symbol}`,
      () => this.adapter.getRecentTrades(symbol),
      5 // Cache for 5 seconds
    );
  }

  // ─────────────────────────────────────────────────────────────
  // Account Data (Cached with Deduplication)
  // ─────────────────────────────────────────────────────────────

  async getAccount(accountId: string): Promise<Account> {
    return this.withCacheAndDedup(
      `account:${accountId}`,
      () => this.adapter.getAccount(accountId),
      5 // Cache for 5 seconds
    );
  }

  async getPositions(accountId: string): Promise<Position[]> {
    return this.withCacheAndDedup(
      `positions:${accountId}`,
      () => this.adapter.getPositions(accountId),
      5 // Cache for 5 seconds
    );
  }

  async getOpenOrders(accountId: string): Promise<Order[]> {
    return this.withCacheAndDedup(
      `orders:${accountId}`,
      () => this.adapter.getOpenOrders(accountId),
      3 // Cache for 3 seconds (orders change frequently)
    );
  }

  async getTradeHistory(params: TradeHistoryParams): Promise<TradeHistoryItem[]> {
    const cacheKey = `trades:history:${params.accountId}:${params.symbol || 'all'}:${params.startTime || 'all'}`;
    return this.withCache(
      cacheKey,
      () => this.adapter.getTradeHistory(params),
      10 // Cache for 10 seconds
    );
  }

  async getAccountSettings(accountId: string): Promise<AccountSetting[]> {
    return this.withCache(
      `settings:${accountId}`,
      () => this.adapter.getAccountSettings(accountId),
      60 // Cache for 1 minute (settings rarely change)
    );
  }

  // ─────────────────────────────────────────────────────────────
  // Trading Operations (NO CACHE - Always Fresh)
  // ─────────────────────────────────────────────────────────────

  async createMarketOrder(auth: AuthContext, params: MarketOrderParams): Promise<{ orderId: string | number }> {
    // Invalidate cache after order placement
    const result = await this.adapter.createMarketOrder(auth, params);
    await this.invalidateAccountCache(auth.accountId);
    return result;
  }

  async createLimitOrder(auth: AuthContext, params: LimitOrderParams): Promise<{ orderId: string | number }> {
    const result = await this.adapter.createLimitOrder(auth, params);
    await this.invalidateAccountCache(auth.accountId);
    return result;
  }

  async createStopOrder(auth: AuthContext, params: StopOrderParams): Promise<{ orderId: string | number }> {
    const result = await this.adapter.createStopOrder(auth, params);
    await this.invalidateAccountCache(auth.accountId);
    return result;
  }

  async cancelOrder(auth: AuthContext, params: CancelOrderParams): Promise<{ success: boolean }> {
    const result = await this.adapter.cancelOrder(auth, params);
    await this.invalidateAccountCache(auth.accountId);
    return result;
  }

  async cancelAllOrders(auth: AuthContext, params: CancelAllOrdersParams): Promise<{ cancelledCount: number }> {
    const result = await this.adapter.cancelAllOrders(auth, params);
    await this.invalidateAccountCache(auth.accountId);
    return result;
  }

  async updateLeverage(auth: AuthContext, symbol: string, leverage: number): Promise<{ success: boolean }> {
    const result = await this.adapter.updateLeverage(auth, symbol, leverage);
    await this.redis.del(`${this.adapter.name}:settings:${auth.accountId}`).catch(() => {
      // Ignore cache invalidation errors
    });
    return result;
  }

  // ─────────────────────────────────────────────────────────────
  // Optional Methods (Pass-through)
  // ─────────────────────────────────────────────────────────────

  async approveBuilderCode?(auth: AuthContext, builderCode: string, maxFeeRate: number): Promise<{ success: boolean }> {
    if (this.adapter.approveBuilderCode) {
      return this.adapter.approveBuilderCode(auth, builderCode, maxFeeRate);
    }
    throw new Error('approveBuilderCode not supported by this exchange');
  }

  async withdraw?(auth: AuthContext, amount: string): Promise<{ success: boolean }> {
    if (this.adapter.withdraw) {
      const result = await this.adapter.withdraw(auth, amount);
      await this.invalidateAccountCache(auth.accountId);
      return result;
    }
    throw new Error('withdraw not supported by this exchange');
  }

  // ─────────────────────────────────────────────────────────────
  // Cache Helpers
  // ─────────────────────────────────────────────────────────────

  /**
   * Cache with Redis (with timeout to prevent hanging)
   */
  private async withCache<T>(
    cacheKey: string,
    fetcher: () => Promise<T>,
    ttlSeconds: number
  ): Promise<T> {
    const prefixedKey = `${this.adapter.name}:${cacheKey}`;

    try {
      // Try cache first with 1 second timeout
      const cached = await Promise.race([
        this.redis.get(prefixedKey),
        new Promise<null>((_, reject) => setTimeout(() => reject(new Error('Redis timeout')), 1000))
      ]);

      if (cached) {
        return JSON.parse(cached);
      }
    } catch (error: any) {
      if (error.message !== 'Redis timeout') {
        console.warn('[CachedAdapter] Redis cache read failed:', error.message);
      }
      // Fall through to fetcher
    }

    // Cache miss - fetch from exchange
    const result = await fetcher();

    // Store in cache (fire and forget, with timeout)
    Promise.race([
      this.redis.setex(prefixedKey, ttlSeconds, JSON.stringify(result)),
      new Promise((_, reject) => setTimeout(() => reject(new Error('Redis timeout')), 1000))
    ]).catch((error: any) => {
      console.warn('[CachedAdapter] Redis cache write failed:', error.message);
    });

    return result;
  }

  /**
   * Cache with deduplication (share promise across concurrent requests, with timeout)
   */
  private async withCacheAndDedup<T>(
    cacheKey: string,
    fetcher: () => Promise<T>,
    ttlSeconds: number
  ): Promise<T> {
    const prefixedKey = `${this.adapter.name}:${cacheKey}`;

    try {
      // Try cache first with 1 second timeout
      const cached = await Promise.race([
        this.redis.get(prefixedKey),
        new Promise<null>((_, reject) => setTimeout(() => reject(new Error('Redis timeout')), 1000))
      ]);

      if (cached) {
        return JSON.parse(cached);
      }
    } catch (error: any) {
      if (error.message !== 'Redis timeout') {
        console.warn('[CachedAdapter] Redis cache read failed:', error.message);
      }
      // Fall through to fetcher
    }

    // Check if request is already in flight
    if (this.pendingRequests.has(prefixedKey)) {
      return this.pendingRequests.get(prefixedKey)!;
    }

    // Create new request
    const promise = fetcher()
      .then((result) => {
        // Store in cache with timeout
        Promise.race([
          this.redis.setex(prefixedKey, ttlSeconds, JSON.stringify(result)),
          new Promise((_, reject) => setTimeout(() => reject(new Error('Redis timeout')), 1000))
        ]).catch((error: any) => {
          console.warn('[CachedAdapter] Redis cache write failed:', error.message);
        });
        return result;
      })
      .finally(() => {
        // Clean up pending request
        this.pendingRequests.delete(prefixedKey);
      });

    this.pendingRequests.set(prefixedKey, promise);

    return promise;
  }

  /**
   * Invalidate account-related cache keys
   */
  private async invalidateAccountCache(accountId: string): Promise<void> {
    const keys = [
      `${this.adapter.name}:account:${accountId}`,
      `${this.adapter.name}:positions:${accountId}`,
      `${this.adapter.name}:orders:${accountId}`,
    ];

    await this.redis.del(...keys).catch((error) => {
      console.warn('[CachedAdapter] Redis cache invalidation failed:', error);
    });
  }

  /**
   * Disconnect Redis (cleanup)
   */
  async disconnect(): Promise<void> {
    await this.redis.quit();
  }
}
