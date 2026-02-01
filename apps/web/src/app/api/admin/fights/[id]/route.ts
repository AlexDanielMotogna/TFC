/**
 * Admin Fight Detail API
 * GET /api/admin/fights/[id] - Get fight details with trades and snapshots
 */
import { withAdminAuth } from '@/lib/server/admin-auth';
import { prisma } from '@/lib/server/db';
import { errorResponse, NotFoundError } from '@/lib/server/errors';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    return withAdminAuth(request, async () => {
      const fight = await prisma.fight.findUnique({
        where: { id },
        include: {
          creator: { select: { id: true, handle: true, walletAddress: true } },
          participants: {
            include: {
              user: { select: { id: true, handle: true, walletAddress: true } },
            },
          },
          trades: {
            orderBy: { executedAt: 'desc' },
            take: 100,
          },
          snapshots: {
            orderBy: { timestamp: 'asc' },
            take: 100,
          },
          sessions: {
            orderBy: { createdAt: 'desc' },
            take: 20,
          },
          violations: {
            orderBy: { createdAt: 'desc' },
          },
        },
      });

      if (!fight) {
        throw new NotFoundError('Fight not found');
      }

      // Get participant details
      const participantA = fight.participants.find((p) => p.slot === 'A');
      const participantB = fight.participants.find((p) => p.slot === 'B');

      return {
        id: fight.id,
        status: fight.status,
        durationMinutes: fight.durationMinutes,
        stakeUsdc: fight.stakeUsdc,
        createdAt: fight.createdAt,
        startedAt: fight.startedAt,
        endedAt: fight.endedAt,
        winnerId: fight.winnerId,
        isDraw: fight.isDraw,
        creator: fight.creator,
        participantA: participantA
          ? {
              userId: participantA.userId,
              handle: participantA.user.handle,
              walletAddress: participantA.user.walletAddress,
              slot: participantA.slot,
              joinedAt: participantA.joinedAt,
              initialPositions: participantA.initialPositions,
              maxExposureUsed: Number(participantA.maxExposureUsed),
              finalPnlPercent: participantA.finalPnlPercent
                ? Number(participantA.finalPnlPercent)
                : null,
              finalScoreUsdc: participantA.finalScoreUsdc
                ? Number(participantA.finalScoreUsdc)
                : null,
              tradesCount: participantA.tradesCount,
              externalTradesDetected: participantA.externalTradesDetected,
              externalTradeIds: participantA.externalTradeIds,
            }
          : null,
        participantB: participantB
          ? {
              userId: participantB.userId,
              handle: participantB.user.handle,
              walletAddress: participantB.user.walletAddress,
              slot: participantB.slot,
              joinedAt: participantB.joinedAt,
              initialPositions: participantB.initialPositions,
              maxExposureUsed: Number(participantB.maxExposureUsed),
              finalPnlPercent: participantB.finalPnlPercent
                ? Number(participantB.finalPnlPercent)
                : null,
              finalScoreUsdc: participantB.finalScoreUsdc
                ? Number(participantB.finalScoreUsdc)
                : null,
              tradesCount: participantB.tradesCount,
              externalTradesDetected: participantB.externalTradesDetected,
              externalTradeIds: participantB.externalTradeIds,
            }
          : null,
        trades: fight.trades.map((t) => ({
          id: t.id,
          participantUserId: t.participantUserId,
          symbol: t.symbol,
          side: t.side,
          amount: Number(t.amount),
          price: Number(t.price),
          fee: Number(t.fee),
          pnl: t.pnl ? Number(t.pnl) : null,
          leverage: t.leverage,
          executedAt: t.executedAt,
        })),
        snapshots: fight.snapshots.map((s) => ({
          timestamp: s.timestamp,
          participantAPnlPercent: Number(s.participantAPnlPercent),
          participantAScoreUsdc: Number(s.participantAScoreUsdc),
          participantBPnlPercent: Number(s.participantBPnlPercent),
          participantBScoreUsdc: Number(s.participantBScoreUsdc),
          leaderId: s.leaderId,
        })),
        sessions: fight.sessions.map((s) => ({
          userId: s.userId,
          sessionType: s.sessionType,
          ipAddress: s.ipAddress,
          userAgent: s.userAgent,
          createdAt: s.createdAt,
        })),
        violations: fight.violations.map((v) => ({
          ruleCode: v.ruleCode,
          ruleName: v.ruleName,
          ruleMessage: v.ruleMessage,
          actionTaken: v.actionTaken,
          metadata: v.metadata,
          createdAt: v.createdAt,
        })),
        // Calculate time remaining for live fights
        timeRemaining:
          fight.status === 'LIVE' && fight.startedAt
            ? Math.max(
                0,
                fight.durationMinutes * 60 -
                  Math.floor(
                    (Date.now() - new Date(fight.startedAt).getTime()) / 1000
                  )
              )
            : null,
      };
    });
  } catch (error) {
    return errorResponse(error);
  }
}
