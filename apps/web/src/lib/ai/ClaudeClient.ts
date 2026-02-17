/**
 * Claude API Client
 * Thin wrapper around Anthropic SDK with timeout, circuit breaker,
 * and cost-aware model selection.
 */

import Anthropic from '@anthropic-ai/sdk';
import type { AiServiceError } from './types/AiBias.types';

const DEFAULT_TIMEOUT_MS = 15_000;
const CIRCUIT_BREAKER_THRESHOLD = 5;   // Consecutive failures to trip
const CIRCUIT_BREAKER_RESET_MS = 60_000; // 60s before retrying after trip

interface ClaudeClientConfig {
  apiKey: string;
  model?: string;
  maxTokens?: number;
  timeoutMs?: number;
}

interface ClaudeResponse {
  content: string;
  inputTokens: number;
  outputTokens: number;
  model: string;
}

export class ClaudeClient {
  private client: Anthropic;
  private readonly model: string;
  private readonly maxTokens: number;
  private readonly timeoutMs: number;

  // Circuit breaker state
  private consecutiveFailures = 0;
  private circuitOpenUntil = 0;

  constructor(config: ClaudeClientConfig) {
    this.client = new Anthropic({ apiKey: config.apiKey });
    this.model = config.model ?? 'claude-haiku-4-5-20251001';
    this.maxTokens = config.maxTokens ?? 1024;
    this.timeoutMs = config.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  }

  /**
   * Send a message to Claude and get a text response.
   * Handles timeout, circuit breaker, and error mapping.
   */
  async analyze(systemPrompt: string, userPrompt: string): Promise<ClaudeResponse> {
    // Circuit breaker check
    if (this.isCircuitOpen()) {
      const error: AiServiceError = {
        code: 'AI_UNAVAILABLE',
        message: 'AI service temporarily unavailable (circuit breaker open)',
        retryAfter: Math.ceil((this.circuitOpenUntil - Date.now()) / 1000),
      };
      throw error;
    }

    try {
      const response = await this.callWithTimeout(systemPrompt, userPrompt);
      this.consecutiveFailures = 0; // Reset on success
      return response;
    } catch (err) {
      this.consecutiveFailures++;

      if (this.consecutiveFailures >= CIRCUIT_BREAKER_THRESHOLD) {
        this.circuitOpenUntil = Date.now() + CIRCUIT_BREAKER_RESET_MS;
        console.error(`[ClaudeClient] Circuit breaker tripped after ${CIRCUIT_BREAKER_THRESHOLD} failures`);
      }

      throw this.mapError(err);
    }
  }

  private async callWithTimeout(systemPrompt: string, userPrompt: string): Promise<ClaudeResponse> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await this.client.messages.create(
        {
          model: this.model,
          max_tokens: this.maxTokens,
          system: systemPrompt,
          messages: [{ role: 'user', content: userPrompt }],
        },
        { signal: controller.signal }
      );

      const textBlock = response.content.find(b => b.type === 'text');
      if (!textBlock || textBlock.type !== 'text') {
        const error: AiServiceError = {
          code: 'INVALID_RESPONSE',
          message: 'Claude returned no text content',
        };
        throw error;
      }

      return {
        content: textBlock.text,
        inputTokens: response.usage.input_tokens,
        outputTokens: response.usage.output_tokens,
        model: response.model,
      };
    } finally {
      clearTimeout(timer);
    }
  }

  private isCircuitOpen(): boolean {
    if (this.circuitOpenUntil === 0) return false;
    if (Date.now() >= this.circuitOpenUntil) {
      // Reset circuit breaker — allow one attempt
      this.circuitOpenUntil = 0;
      this.consecutiveFailures = 0;
      return false;
    }
    return true;
  }

  private mapError(err: unknown): AiServiceError {
    // Already an AiServiceError
    if (typeof err === 'object' && err !== null && 'code' in err && 'message' in err) {
      return err as AiServiceError;
    }

    // Anthropic SDK errors
    if (err instanceof Anthropic.APIError) {
      if (err.status === 429) {
        return {
          code: 'RATE_LIMITED',
          message: 'Claude API rate limited',
          retryAfter: 30,
        };
      }
      return {
        code: 'AI_UNAVAILABLE',
        message: `Claude API error: ${err.message}`,
      };
    }

    // Abort/timeout
    if (err instanceof Error && err.name === 'AbortError') {
      return {
        code: 'AI_UNAVAILABLE',
        message: `Claude request timed out after ${this.timeoutMs}ms`,
      };
    }

    return {
      code: 'AI_UNAVAILABLE',
      message: err instanceof Error ? err.message : 'Unknown AI error',
    };
  }
}
