/**
 * AI Bias Service — Main Orchestrator
 * Coordinates market data fetching, prompt building, Claude API calls,
 * caching, rate limiting, and response validation.
 *
 * This is the single entry point for the API route handler.
 */

import type { AiBiasRequest, AiSignalResponse, AiServiceError, RiskProfile } from './types/AiBias.types';
import type { IMarketDataAggregator } from './market/IMarketDataProvider';
import { PromptBuilder } from './PromptBuilder';
import { ClaudeClient } from './ClaudeClient';
import { AiResponseValidator } from './AiResponseValidator';
import { CacheManager } from './cache/CacheManager';
import { RateLimiter } from './security/RateLimiter';

// ─── Configuration ────────────────────────────────────────────

const RATE_LIMIT_MAX = parseInt(process.env.AI_RATE_LIMIT_MAX || '5', 10);
const RATE_LIMIT_WINDOW_MS = 60_000; // 1 minute window
const CACHE_TTL_MS = 60_000;         // 60s cache

// ─── Singleton instances (module-level, survives across requests) ──

let instance: AiBiasService | null = null;

export class AiBiasService {
  private readonly claude: ClaudeClient;
  private readonly cache: CacheManager;
  private readonly rateLimiter: RateLimiter;
  private readonly marketData: IMarketDataAggregator;

  constructor(
    marketData: IMarketDataAggregator,
    claudeClient?: ClaudeClient,
  ) {
    this.marketData = marketData;

    this.claude = claudeClient ?? new ClaudeClient({
      apiKey: process.env.ANTHROPIC_API_KEY ?? '',
    });

    this.cache = new CacheManager(CACHE_TTL_MS);
    this.rateLimiter = new RateLimiter(RATE_LIMIT_MAX, RATE_LIMIT_WINDOW_MS);
  }

  /**
   * Get or create the singleton service instance.
   * Uses lazy initialization so the API key is read at request time.
   */
  static getInstance(marketData: IMarketDataAggregator): AiBiasService {
    if (!instance) {
      instance = new AiBiasService(marketData);
    }
    return instance;
  }

  /**
   * Main entry point: analyze market data and return AI bias.
   */
  async analyze(request: AiBiasRequest): Promise<AiSignalResponse> {
    const { symbol, riskProfile, userId } = request;

    // 1. Rate limit check
    this.checkRateLimit(userId);

    // 2. Validate API key is configured
    if (!process.env.ANTHROPIC_API_KEY) {
      throw this.createError('AI_UNAVAILABLE', 'AI analysis is not configured');
    }

    // 3. Fetch market data
    const marketBundle = await this.fetchMarketData(symbol);

    // 4. Check cache (with data hash)
    const dataHash = CacheManager.computeDataHash(marketBundle);
    const cacheKey = CacheManager.buildKey(symbol, riskProfile);
    const cached = this.cache.get(cacheKey, dataHash);
    if (cached) {
      return cached;
    }

    // 5. Build prompts
    const systemPrompt = PromptBuilder.buildSystemPrompt();
    const userPrompt = PromptBuilder.buildUserPrompt(marketBundle, riskProfile, request.openPositions);

    // 6. Call Claude
    const claudeResponse = await this.claude.analyze(systemPrompt, userPrompt);

    // 7. Validate and parse response
    const validated = AiResponseValidator.validate(claudeResponse.content, riskProfile);

    // 8. Cache the result
    this.cache.set(cacheKey, validated, dataHash);

    // 9. Log cost info (non-blocking)
    this.logUsage(symbol, riskProfile, claudeResponse.inputTokens, claudeResponse.outputTokens, claudeResponse.model);

    return validated;
  }

  private checkRateLimit(userId: string): void {
    const result = this.rateLimiter.check(userId);
    if (!result.allowed) {
      const error: AiServiceError = {
        code: 'RATE_LIMITED',
        message: 'Too many AI analysis requests. Please wait before trying again.',
        retryAfter: result.retryAfter,
      };
      throw error;
    }
  }

  private async fetchMarketData(symbol: string) {
    try {
      return await this.marketData.getMarketDataBundle(symbol);
    } catch (err) {
      const error: AiServiceError = {
        code: 'MARKET_DATA_ERROR',
        message: `Failed to fetch market data: ${err instanceof Error ? err.message : 'Unknown error'}`,
      };
      throw error;
    }
  }

  private logUsage(
    symbol: string,
    riskProfile: RiskProfile,
    inputTokens: number,
    outputTokens: number,
    model: string,
  ): void {
    // Estimated cost: Haiku 4.5 pricing ($0.80/M input, $4/M output)
    const inputCost = (inputTokens / 1_000_000) * 0.80;
    const outputCost = (outputTokens / 1_000_000) * 4.00;
    const totalCost = inputCost + outputCost;

    console.log(
      `[AiBias] ${symbol} (${riskProfile}) | ${model} | ` +
      `${inputTokens}in/${outputTokens}out | $${totalCost.toFixed(4)} | ` +
      `cache: ${this.cache.size} entries`
    );
  }

  private createError(code: AiServiceError['code'], message: string): AiServiceError {
    return { code, message };
  }
}
