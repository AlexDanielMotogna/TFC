/**
 * Admin: Migrate fight_trades to trades table
 * POST /api/admin/migrate-trades
 *
 * Backfills the trades table with data from fight_trades
 * NOTE: Does NOT delete from fight_trades, only copies to trades
 */
import { prisma } from '@tfc/db';
import { NextResponse } from 'next/server';

export async function POST() {
  try {
    // Skip auth in development
    if (process.env.NODE_ENV === 'production') {
      return NextResponse.json(
        { success: false, error: 'Not available in production' },
        { status: 403 }
      );
    }

    console.log('[Migrate Trades] Starting migration from fight_trades to trades...');

    // Get all fight_trades that are not yet in trades table
    const fightTrades = await prisma.fightTrade.findMany({
      include: {
        fight: {
          include: {
            participants: true,
          },
        },
      },
    });

    console.log(`[Migrate Trades] Found ${fightTrades.length} fight trades to process`);

    let migrated = 0;
    let skipped = 0;
    let errors = 0;

    for (const ft of fightTrades) {
      try {
        // Check if trade already exists
        const existing = await prisma.trade.findUnique({
          where: { pacificaHistoryId: ft.pacificaHistoryId },
        });

        if (existing) {
          skipped++;
          continue;
        }

        // Create trade record
        await prisma.trade.create({
          data: {
            userId: ft.participantUserId,
            pacificaHistoryId: ft.pacificaHistoryId,
            pacificaOrderId: ft.pacificaOrderId,
            symbol: ft.symbol,
            side: ft.side,
            amount: ft.amount,
            price: ft.price,
            fee: ft.fee,
            pnl: ft.pnl,
            leverage: ft.leverage,
            fightId: ft.fightId,
            executedAt: ft.executedAt,
          },
        });

        migrated++;
      } catch (err) {
        console.error(`[Migrate Trades] Error migrating trade ${ft.id}:`, err);
        errors++;
      }
    }

    console.log(`[Migrate Trades] Migration complete: ${migrated} migrated, ${skipped} skipped, ${errors} errors`);

    // Calculate new totals
    const volumeResult = await prisma.$queryRaw<[{ volume: number; fees: number }]>`
      SELECT
        COALESCE(SUM(amount * price), 0)::float as volume,
        COALESCE(SUM(amount * price) * 0.0005, 0)::float as fees
      FROM trades
    `;

    return NextResponse.json({
      success: true,
      data: {
        totalFightTrades: fightTrades.length,
        migrated,
        skipped,
        errors,
        newTotals: {
          totalVolume: volumeResult[0]?.volume || 0,
          totalBuilderFees: volumeResult[0]?.fees || 0,
        },
      },
    });
  } catch (error) {
    console.error('[Migrate Trades] Error:', error);
    return NextResponse.json(
      { success: false, error: 'Migration failed' },
      { status: 500 }
    );
  }
}

// Also support GET for easy browser access
export async function GET() {
  return POST();
}
