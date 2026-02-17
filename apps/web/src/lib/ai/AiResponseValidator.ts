/**
 * AI Response Validator
 * Validates and sanitizes Claude's JSON output using Zod schemas.
 * Ensures the response conforms to our type contract before reaching the client.
 */

import { z } from 'zod';
import type { AiSignalResponse, AiServiceError } from './types/AiBias.types';

// ─── Zod Schema ───────────────────────────────────────────────

const KeyFactorSchema = z.object({
  factor: z.string().min(1).max(100),
  bias: z.enum(['bullish', 'bearish', 'neutral']),
  detail: z.string().min(1).max(1000).transform(s => s.slice(0, 500)),
});

const PositionAdviceSchema = z.object({
  symbol: z.string().min(1).max(50),
  action: z.enum(['HOLD', 'CLOSE', 'ADD', 'REDUCE', 'MOVE_SL']),
  detail: z.string().min(1).max(1000).transform(s => s.slice(0, 500)),
});

const AiSignalResponseSchema = z.object({
  signal: z.enum(['LONG', 'SHORT', 'STAY_OUT']),
  confidence: z.number().int().min(0).max(100),
  entry: z.number().finite(),
  stopLoss: z.number().finite(),
  takeProfit: z.number().finite(),
  suggestedLeverage: z.number().finite().min(0).max(10),
  riskPercent: z.number().finite().min(0).max(10),
  summary: z.string().min(10).max(1000),
  riskProfile: z.enum(['conservative', 'moderate', 'aggressive']),
  keyFactors: z.array(KeyFactorSchema).min(1).max(10),
  positionAdvice: z.array(PositionAdviceSchema).max(20),
  disclaimer: z.string().min(10),
});

// ─── Forbidden words check ───────────────────────────────────

const FORBIDDEN_WORDS = [
  'guaranteed', 'will happen', 'definitely',
  'certainly', 'risk-free',
];

function containsForbiddenWords(text: string): string[] {
  const lower = text.toLowerCase();
  return FORBIDDEN_WORDS.filter(word => lower.includes(word));
}

// ─── Validator ────────────────────────────────────────────────

const ANALYSIS_TTL_MS = 60_000; // 60 seconds validity

export class AiResponseValidator {
  /**
   * Parse, validate, and enrich Claude's raw JSON string into a typed response.
   * Throws AiServiceError if validation fails.
   */
  static validate(raw: string, expectedRiskProfile: string): AiSignalResponse {
    // Step 1: Extract JSON from response (Claude may wrap in markdown code blocks)
    const jsonStr = extractJson(raw);

    let parsed: unknown;
    try {
      parsed = JSON.parse(jsonStr);
    } catch {
      console.error('[AiResponseValidator] Failed to parse JSON. Raw response:', raw.slice(0, 500));
      throw createValidationError(`Failed to parse AI response as JSON`);
    }

    // Step 2: Validate with Zod schema
    const result = AiSignalResponseSchema.safeParse(parsed);
    if (!result.success) {
      const issues = result.error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join('; ');
      throw createValidationError(`AI response validation failed: ${issues}`);
    }

    const data = result.data;

    // Step 3: Verify risk profile matches request
    if (data.riskProfile !== expectedRiskProfile) {
      throw createValidationError(
        `Risk profile mismatch: expected ${expectedRiskProfile}, got ${data.riskProfile}`
      );
    }

    // Step 4: Check for forbidden words in summary and key factors
    const allText = [
      data.summary,
      ...data.keyFactors.map(f => f.detail),
    ].join(' ');

    const forbidden = containsForbiddenWords(allText);
    if (forbidden.length > 0) {
      throw createValidationError(
        `AI response contains forbidden words: ${forbidden.join(', ')}`
      );
    }

    // Step 5: Validate signal-specific constraints
    if (data.signal !== 'STAY_OUT') {
      if (data.entry <= 0) {
        throw createValidationError('Entry price must be positive for LONG/SHORT signals');
      }
      if (data.stopLoss <= 0) {
        throw createValidationError('Stop loss must be positive for LONG/SHORT signals');
      }
      if (data.takeProfit <= 0) {
        throw createValidationError('Take profit must be positive for LONG/SHORT signals');
      }

      // LONG: SL < entry < TP
      if (data.signal === 'LONG') {
        if (data.stopLoss >= data.entry) {
          throw createValidationError('LONG signal: stop loss must be below entry');
        }
        if (data.takeProfit <= data.entry) {
          throw createValidationError('LONG signal: take profit must be above entry');
        }
      }

      // SHORT: TP < entry < SL
      if (data.signal === 'SHORT') {
        if (data.stopLoss <= data.entry) {
          throw createValidationError('SHORT signal: stop loss must be above entry');
        }
        if (data.takeProfit >= data.entry) {
          throw createValidationError('SHORT signal: take profit must be below entry');
        }
      }

      if (data.suggestedLeverage <= 0) {
        throw createValidationError('Suggested leverage must be positive for LONG/SHORT signals');
      }
      if (data.riskPercent <= 0) {
        throw createValidationError('Risk percent must be positive for LONG/SHORT signals');
      }
    }

    // Step 6: Enrich with timestamps
    const now = Date.now();
    return {
      ...data,
      timestamp: now,
      expiresAt: now + ANALYSIS_TTL_MS,
    };
  }
}

/**
 * Extract JSON from Claude's response.
 * Handles: raw JSON, ```json ... ```, ``` ... ```, or text with embedded JSON.
 */
function extractJson(raw: string): string {
  const trimmed = raw.trim();

  // If it starts with { or [, it's already raw JSON
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    return trimmed;
  }

  // Try to extract from markdown code block: ```json ... ``` or ``` ... ```
  const codeBlockMatch = trimmed.match(/```(?:json)?\s*\n?([\s\S]*?)\n?\s*```/);
  if (codeBlockMatch?.[1]) {
    return codeBlockMatch[1].trim();
  }

  // Try to find first { ... last } in the response
  const firstBrace = trimmed.indexOf('{');
  const lastBrace = trimmed.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    return trimmed.slice(firstBrace, lastBrace + 1);
  }

  // Return as-is and let JSON.parse fail with a helpful error
  return trimmed;
}

function createValidationError(message: string): AiServiceError {
  return {
    code: 'VALIDATION_ERROR',
    message,
  };
}
