/**
 * Stake info endpoint
 * GET /api/fights/stake-info?account=...&fightId=...
 * Returns stake limit info for users in active fights
 *
 * If fightId is provided, returns info for that specific fight
 * Otherwise, returns info for any active fight the user is in
 *
 * @see MVP-SIMPLIFIED-RULES.md - Stake Limit section
 */
import { errorResponse, BadRequestError } from '@/lib/server/errors';
import { ErrorCode } from '@/lib/server/error-codes';
import { prisma, FightStatus } from '@tfc/db';
import {
  calculateFightExposure,
  calculateAvailableCapital,
} from '@/lib/server/fight-exposure';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const account = searchParams.get('account');
    const fightId = searchParams.get('fightId');

    if (!account) {
      throw new BadRequestError('account is required', ErrorCode.ERR_VALIDATION_MISSING_FIELD);
    }

    // Get user from account
    const connection = await prisma.pacificaConnection.findUnique({
      where: { accountAddress: account },
    });

    if (!connection) {
      // Not linked to TFC - no stake info
      return Response.json({
        success: true,
        data: {
          inFight: false,
          stake: null,
          currentExposure: null,
          available: null,
        },
      });
    }

    // Build query - if fightId is provided, look for that specific fight
    // Otherwise, look for any active fight
    const whereClause = fightId
      ? {
          userId: connection.userId,
          fightId: fightId,
          fight: { status: FightStatus.LIVE },
        }
      : {
          userId: connection.userId,
          fight: { status: FightStatus.LIVE },
        };

    // Check if in active fight
    const participant = await prisma.fightParticipant.findFirst({
      where: whereClause,
      include: {
        fight: {
          select: {
            id: true,
            stakeUsdc: true,
          },
        },
      },
    });

    if (!participant) {
      return Response.json({
        success: true,
        data: {
          inFight: false,
          stake: null,
          currentExposure: null,
          available: null,
        },
      });
    }

    // Calculate current exposure using centralized utility
    const { currentExposure } = await calculateFightExposure(
      participant.fight.id,
      connection.userId
    );

    const stake = participant.fight.stakeUsdc;
    const maxExposureUsed = parseFloat(
      participant.maxExposureUsed?.toString() || '0'
    );

    // Calculate available capital using centralized formula
    const available = calculateAvailableCapital(
      stake,
      maxExposureUsed,
      currentExposure
    );

    // Get blocked symbols (symbols with pre-fight positions that can't be traded)
    const blockedSymbols = (participant as any).blockedSymbols as string[] || [];

    return Response.json({
      success: true,
      data: {
        inFight: true,
        fightId: participant.fight.id,
        stake,
        currentExposure,
        maxExposureUsed,
        available,
        blockedSymbols,
      },
    });
  } catch (error) {
    return errorResponse(error);
  }
}
