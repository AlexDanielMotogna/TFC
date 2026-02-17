/**
 * AI Market Bias Analysis Endpoint
 * POST /api/ai/bias
 *
 * Authenticated endpoint that returns AI-generated market bias analysis.
 * Rate limited to 10 requests per minute per user.
 */

import { withAuth } from '@/lib/server/auth';
import { errorResponse, BadRequestError } from '@/lib/server/errors';
import { AiBiasService } from '@/lib/ai/AiBiasService';
import { MarketDataAggregator } from '@/lib/ai/market/MarketDataAggregator';
import { PacificaProvider } from '@/lib/ai/market/PacificaProvider';
import type { AiBiasRequest, AiServiceError, RiskProfile } from '@/lib/ai/types/AiBias.types';

const VALID_RISK_PROFILES: RiskProfile[] = ['conservative', 'moderate', 'aggressive'];

// Lazy-initialized aggregator (module-level singleton)
let aggregator: MarketDataAggregator | null = null;

function getAggregator(): MarketDataAggregator {
  if (!aggregator) {
    aggregator = new MarketDataAggregator([new PacificaProvider()]);
  }
  return aggregator;
}

export async function POST(request: Request) {
  // Parse body BEFORE withAuth (Request body stream can only be consumed once)
  let body: Record<string, unknown> | null = null;
  try {
    body = await request.json();
  } catch {
    return Response.json({ success: false, error: 'Invalid JSON body' }, { status: 400 });
  }

  try {
    return await withAuth(request, async (user) => {
      if (!body || typeof body !== 'object') {
        throw new BadRequestError('Request body is required');
      }

      const { symbol, riskProfile, openPositions } = body as { symbol?: string; riskProfile?: string; openPositions?: unknown[] };

      if (!symbol || typeof symbol !== 'string') {
        throw new BadRequestError('symbol is required (e.g. "BTC-USD")');
      }

      if (!riskProfile || !VALID_RISK_PROFILES.includes(riskProfile as RiskProfile)) {
        throw new BadRequestError(`riskProfile must be one of: ${VALID_RISK_PROFILES.join(', ')}`);
      }

      // Normalize symbol
      const normalizedSymbol = symbol.toUpperCase().includes('-USD')
        ? symbol.toUpperCase()
        : `${symbol.toUpperCase()}-USD`;

      // Get service and analyze
      const service = AiBiasService.getInstance(getAggregator());

      console.log(`[AI Bias] Analyzing ${normalizedSymbol} (${riskProfile}) for user ${user.userId}`);

      const result = await service.analyze({
        symbol: normalizedSymbol,
        riskProfile: riskProfile as RiskProfile,
        userId: user.userId,
        openPositions: Array.isArray(openPositions) ? openPositions as AiBiasRequest['openPositions'] : undefined,
      });

      return Response.json({ success: true, data: result });
    });
  } catch (error) {
    console.error('[AI Bias] Route error:', error);
    // Map AiServiceError to HTTP responses
    if (isAiServiceError(error)) {
      return mapAiErrorToResponse(error);
    }
    return errorResponse(error);
  }
}

function isAiServiceError(err: unknown): err is AiServiceError {
  return (
    typeof err === 'object' &&
    err !== null &&
    'code' in err &&
    'message' in err &&
    typeof (err as AiServiceError).code === 'string'
  );
}

function mapAiErrorToResponse(error: AiServiceError): Response {
  const statusMap: Record<AiServiceError['code'], number> = {
    RATE_LIMITED: 429,
    AI_UNAVAILABLE: 503,
    INVALID_RESPONSE: 502,
    MARKET_DATA_ERROR: 502,
    VALIDATION_ERROR: 500,
  };

  const status = statusMap[error.code] || 500;

  const headers: Record<string, string> = {};
  if (error.retryAfter) {
    headers['Retry-After'] = String(error.retryAfter);
  }

  return Response.json(
    {
      success: false,
      error: error.message,
      code: error.code,
      retryAfter: error.retryAfter,
    },
    { status, headers }
  );
}
