/**
 * Internal API: Settle fight with anti-cheat validation
 * POST /api/internal/anti-cheat/settle
 *
 * Called by fight-engine.ts when a fight ends.
 * Validates against all anti-cheat rules and returns final status.
 *
 * @see Anti-Cheat.md
 */

import { NextResponse } from 'next/server';
import { UnauthorizedError, BadRequestError, errorResponse } from '@/lib/server/errors';
import { ErrorCode } from '@/lib/server/error-codes';
import { settleFightWithAntiCheat } from '@/lib/server/anti-cheat';

const INTERNAL_API_KEY = process.env.INTERNAL_API_KEY || 'dev-internal-key';

export async function POST(request: Request) {
  try {
    console.log('[AntiCheat API] Settle endpoint called');

    // Validate internal key
    const key = request.headers.get('X-Internal-Key');
    console.log('[AntiCheat API] Key validation:', { receivedKey: key ? 'present' : 'missing', expectedKey: INTERNAL_API_KEY ? 'configured' : 'default' });

    if (key !== INTERNAL_API_KEY) {
      console.log('[AntiCheat API] Unauthorized - key mismatch');
      throw new UnauthorizedError('Unauthorized', ErrorCode.ERR_AUTH_UNAUTHORIZED);
    }

    const body = await request.json();
    const { fightId, determinedWinnerId, isDraw } = body;
    console.log('[AntiCheat API] Request body:', { fightId, determinedWinnerId, isDraw });

    if (!fightId) {
      throw new BadRequestError('fightId is required', ErrorCode.ERR_VALIDATION_MISSING_FIELD);
    }

    console.log('[AntiCheat API] Calling settleFightWithAntiCheat...');
    const result = await settleFightWithAntiCheat(fightId, determinedWinnerId || null, isDraw || false);
    console.log('[AntiCheat API] Settlement result:', result);

    return NextResponse.json({
      success: true,
      ...result,
    });
  } catch (error) {
    console.error('[AntiCheat] Settlement error:', error);
    return errorResponse(error);
  }
}
