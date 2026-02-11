/**
 * Fights endpoints
 * GET /api/fights - List fights
 * POST /api/fights - Create fight
 */
import { withAuth } from '@/lib/server/auth';
import { prisma } from '@/lib/server/db';
import { errorResponse, BadRequestError, ConflictError } from '@/lib/server/errors';
import { ExchangeProvider } from '@/lib/server/exchanges/provider';
import { FeatureFlags, StakeLimits } from '@/lib/server/feature-flags';
import { recordFightSession } from '@/lib/server/anti-cheat';
import { ErrorCode } from '@/lib/server/error-codes';

const USE_EXCHANGE_ADAPTER = process.env.USE_EXCHANGE_ADAPTER !== 'false';

// Realtime server notification helper
const REALTIME_URL = process.env.REALTIME_URL || 'http://localhost:3002';
const INTERNAL_API_KEY = process.env.INTERNAL_API_KEY || 'dev-internal-key';

async function notifyRealtime(endpoint: string, fightId: string) {
  try {
    await fetch(`${REALTIME_URL}/internal/arena/${endpoint}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Internal-Key': INTERNAL_API_KEY,
      },
      body: JSON.stringify({ fightId }),
    });
  } catch (error) {
    console.error(`[notifyRealtime] Failed to notify realtime: ${endpoint}`, { fightId, error });
  }
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') as 'WAITING' | 'LIVE' | 'FINISHED' | null;
    const page = parseInt(searchParams.get('page') || '1', 10);
    const pageSize = parseInt(searchParams.get('pageSize') || '20', 10);

    const where = status ? { status } : {};

    const [fights, total] = await Promise.all([
      prisma.fight.findMany({
        where,
        include: {
          creator: {
            select: {
              id: true,
              handle: true,
              avatarUrl: true,
            },
          },
          participants: {
            include: {
              user: {
                select: {
                  id: true,
                  handle: true,
                  avatarUrl: true,
                },
              },
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.fight.count({ where }),
    ]);

    return Response.json({
      success: true,
      data: fights,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    return await withAuth(request, async (user) => {
      const body = await request.json();
      const { durationMinutes, stakeUsdc } = body;

      if (!durationMinutes || !stakeUsdc) {
        throw new BadRequestError('durationMinutes and stakeUsdc are required');
      }

      // Feature flag: Check if fight creation is enabled
      if (!FeatureFlags.isPoolCreationEnabled()) {
        throw new BadRequestError('Fight creation is temporarily disabled');
      }

      // Stake limit validation
      if (stakeUsdc > StakeLimits.maxPerFight()) {
        throw new BadRequestError(`Maximum stake per fight is $${StakeLimits.maxPerFight()} USDC`);
      }

      // Check if user has active Pacifica connection
      const connection = await prisma.pacificaConnection.findUnique({
        where: { userId: user.userId },
        select: { isActive: true, accountAddress: true },
      });

      if (!connection?.isActive) {
        throw new BadRequestError('Active Pacifica connection required', ErrorCode.ERR_PACIFICA_CONNECTION_REQUIRED);
      }

      // MVP-1: Check if user already has an active fight (LIVE or WAITING)
      // @see MVP-SIMPLIFIED-RULES.md
      const existingFight = await prisma.fightParticipant.findFirst({
        where: {
          userId: user.userId,
          fight: {
            status: { in: ['LIVE', 'WAITING'] },
          },
        },
        include: {
          fight: {
            select: {
              id: true,
              status: true,
            },
          },
        },
      });

      if (existingFight) {
        const status = existingFight.fight.status === 'LIVE' ? 'active' : 'pending';
        throw new ConflictError(
          `You already have a ${status} fight. Finish or cancel it before starting a new one.`,
          ErrorCode.ERR_FIGHT_USER_HAS_ACTIVE
        );
      }

      // Snapshot creator's current positions from Pacifica
      // This is critical to exclude pre-fight positions from PnL calculation
      // IMPORTANT: We save 'side' to distinguish LONG (bid) vs SHORT (ask) positions
      let creatorPositions: Array<{ symbol: string; amount: string; entry_price: string; side: string }> = [];
      if (connection.accountAddress) {
        try {
          if (USE_EXCHANGE_ADAPTER) {
            // Use Exchange Adapter (with caching if Redis configured)
            const adapter = await ExchangeProvider.getUserAdapter(user.userId);
            const positions = await adapter.getPositions(connection.accountAddress);
            creatorPositions = positions.map((p: any) => ({
              symbol: p.symbol,
              amount: p.amount || p.size,
              entry_price: p.entryPrice || p.entry_price,
              side: p.side === 'LONG' ? 'bid' : p.side === 'SHORT' ? 'ask' : p.side, // Normalize
            }));
          } else {
            // Fallback to direct Pacifica calls
            const Pacifica = await import('@/lib/server/pacifica');
            const positions = await Pacifica.getPositions(connection.accountAddress);
            creatorPositions = positions.map((p: any) => ({
              symbol: p.symbol,
              amount: p.amount,
              entry_price: p.entry_price,
              side: p.side, // 'bid' = LONG, 'ask' = SHORT
            }));
          }
          console.log(`[CreateFight] Creator ${user.userId} has ${creatorPositions.length} open positions:`,
            creatorPositions.map((p: any) => `${p.symbol}: ${p.amount}`).join(', ') || 'none');
        } catch (err) {
          console.error(`[CreateFight] Failed to get creator positions for ${user.userId}:`, err);
          // Continue with empty positions - better to log than fail silently
        }
      }

      // Create fight and creator participant in transaction
      const fight = await prisma.$transaction(async (tx: any) => {
        const newFight = await tx.fight.create({
          data: {
            creatorId: user.userId,
            durationMinutes,
            stakeUsdc,
            status: 'WAITING',
          },
        });

        await tx.fightParticipant.create({
          data: {
            fightId: newFight.id,
            userId: user.userId,
            slot: 'A',
            initialPositions: creatorPositions, // Save positions snapshot at fight creation
          },
        });

        return tx.fight.findUnique({
          where: { id: newFight.id },
          include: {
            creator: {
              select: {
                id: true,
                handle: true,
                avatarUrl: true,
              },
            },
            participants: {
              include: {
                user: {
                  select: {
                    id: true,
                    handle: true,
                    avatarUrl: true,
                  },
                },
              },
            },
          },
        });
      });

      console.log(`[CreateFight] Fight ${fight?.id} created by user ${user.userId}`);

      // Notify realtime server for arena updates
      if (fight?.id) {
        notifyRealtime('fight-created', fight.id);

        // Record fight session for anti-cheat (IP tracking)
        try {
          await recordFightSession(fight.id, user.userId, request, 'join');
        } catch (err) {
          console.error(`[CreateFight] Failed to record fight session:`, err);
          // Non-blocking - continue even if session recording fails
        }
      }

      return fight;
    });
  } catch (error) {
    return errorResponse(error);
  }
}
