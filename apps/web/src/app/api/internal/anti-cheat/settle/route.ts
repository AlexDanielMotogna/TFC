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
import { settleFightWithAntiCheat } from '@/lib/server/anti-cheat';

const INTERNAL_API_KEY = process.env.INTERNAL_API_KEY || 'dev-internal-key';

export async function POST(request: Request) {
  // Validate internal key
  const key = request.headers.get('X-Internal-Key');
  if (key !== INTERNAL_API_KEY) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { fightId, determinedWinnerId, isDraw } = body;

    if (!fightId) {
      return NextResponse.json({ success: false, error: 'fightId is required' }, { status: 400 });
    }

    const result = await settleFightWithAntiCheat(fightId, determinedWinnerId || null, isDraw || false);

    return NextResponse.json({
      success: true,
      ...result,
    });
  } catch (error) {
    console.error('[AntiCheat] Settlement error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Settlement failed',
      },
      { status: 500 }
    );
  }
}
