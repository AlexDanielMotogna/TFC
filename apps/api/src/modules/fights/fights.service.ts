import { Injectable, HttpException, HttpStatus, ForbiddenException, NotFoundException, BadRequestException } from '@nestjs/common';
import { prisma, FightStatus } from '@tfc/db';
import { createLogger, updateContext } from '@tfc/logger';
import {
  LOG_EVENTS,
  FIGHT_JOIN_REJECTION,
  FIGHT_DURATIONS_MINUTES,
  FIGHT_STAKES_USDC,
  type FightDuration,
  type FightStake,
} from '@tfc/shared';

const logger = createLogger({ service: 'api' });

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
    // Log but don't fail the request if realtime notification fails
    logger.warn(LOG_EVENTS.API_ERROR, `Failed to notify realtime: ${endpoint}`, { fightId, error });
  }
}

@Injectable()
export class FightsService {
  /**
   * Create a new fight
   * @see Master-doc.md Section 2
   * @see MVP-SIMPLIFIED-RULES.md - MVP-1: One active fight per user
   */
  async createFight(params: {
    creatorId: string;
    durationMinutes: number;
    stakeUsdc: number;
  }) {
    // MVP-1: Check if user already has an active fight (LIVE or WAITING)
    const existingFight = await prisma.fightParticipant.findFirst({
      where: {
        userId: params.creatorId,
        fight: {
          status: { in: [FightStatus.LIVE, FightStatus.WAITING] },
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
      const status = existingFight.fight.status === FightStatus.LIVE ? 'active' : 'pending';
      logger.warn(LOG_EVENTS.FIGHT_JOIN_REJECTED, 'User already has an active fight', {
        userId: params.creatorId,
        existingFightId: existingFight.fight.id,
        existingStatus: existingFight.fight.status,
      });
      throw new HttpException(
        `You already have a ${status} fight. Finish or cancel it before starting a new one.`,
        HttpStatus.BAD_REQUEST
      );
    }

    // Validate duration
    if (!FIGHT_DURATIONS_MINUTES.includes(params.durationMinutes as FightDuration)) {
      throw new HttpException(
        `Invalid duration. Must be one of: ${FIGHT_DURATIONS_MINUTES.join(', ')}`,
        HttpStatus.BAD_REQUEST
      );
    }

    // Validate stake
    if (!FIGHT_STAKES_USDC.includes(params.stakeUsdc as FightStake)) {
      throw new HttpException(
        `Invalid stake. Must be one of: ${FIGHT_STAKES_USDC.join(', ')}`,
        HttpStatus.BAD_REQUEST
      );
    }

    // Check if user has Pacifica connection
    const connection = await prisma.pacificaConnection.findUnique({
      where: { userId: params.creatorId },
      select: { isActive: true },
    });

    if (!connection?.isActive) {
      throw new HttpException(
        FIGHT_JOIN_REJECTION.NO_PACIFICA_CONNECTION,
        HttpStatus.BAD_REQUEST
      );
    }

    // Create fight and participant in transaction
    const fight = await prisma.$transaction(async (tx) => {
      const newFight = await tx.fight.create({
        data: {
          creatorId: params.creatorId,
          durationMinutes: params.durationMinutes,
          stakeUsdc: params.stakeUsdc,
          status: FightStatus.WAITING,
        },
      });

      // Creator is participant A
      await tx.fightParticipant.create({
        data: {
          fightId: newFight.id,
          userId: params.creatorId,
          slot: 'A',
        },
      });

      return newFight;
    });

    logger.info(LOG_EVENTS.FIGHT_CREATE, 'Fight created', {
      fightId: fight.id,
      userId: params.creatorId,
      durationMinutes: params.durationMinutes,
      stakeUsdc: params.stakeUsdc,
    });

    // Notify realtime server for arena updates
    notifyRealtime('fight-created', fight.id);

    return fight;
  }

  /**
   * Join an existing fight
   * @see Master-doc.md Section 9.4 - Validations
   * @see MVP-SIMPLIFIED-RULES.md - MVP-1: One active fight per user
   */
  async joinFight(fightId: string, userId: string) {
    updateContext({ fightId, userId });

    logger.info(LOG_EVENTS.FIGHT_JOIN_ATTEMPT, 'Attempting to join fight', {
      fightId,
      userId,
    });

    // MVP-1: Check if user already has an active fight (LIVE or WAITING)
    const existingFight = await prisma.fightParticipant.findFirst({
      where: {
        userId,
        fight: {
          status: { in: [FightStatus.LIVE, FightStatus.WAITING] },
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
      const status = existingFight.fight.status === FightStatus.LIVE ? 'active' : 'pending';
      logger.warn(LOG_EVENTS.FIGHT_JOIN_REJECTED, 'User already has an active fight', {
        fightId,
        userId,
        existingFightId: existingFight.fight.id,
        existingStatus: existingFight.fight.status,
      });
      throw new HttpException(
        `You already have a ${status} fight. Finish or cancel it before joining another.`,
        HttpStatus.BAD_REQUEST
      );
    }

    // Get fight with participants
    const fight = await prisma.fight.findUnique({
      where: { id: fightId },
      include: {
        participants: true,
      },
    });

    // Validation: fight exists
    if (!fight) {
      logger.warn(LOG_EVENTS.FIGHT_JOIN_REJECTED, 'Fight not found', {
        fightId,
        userId,
        reasonCode: FIGHT_JOIN_REJECTION.FIGHT_NOT_FOUND,
      });
      throw new HttpException(FIGHT_JOIN_REJECTION.FIGHT_NOT_FOUND, HttpStatus.NOT_FOUND);
    }

    // Validation: status == WAITING
    if (fight.status !== FightStatus.WAITING) {
      logger.warn(LOG_EVENTS.FIGHT_JOIN_REJECTED, 'Fight already started', {
        fightId,
        userId,
        reasonCode: FIGHT_JOIN_REJECTION.FIGHT_ALREADY_LIVE,
        currentStatus: fight.status,
      });
      throw new HttpException(FIGHT_JOIN_REJECTION.FIGHT_ALREADY_LIVE, HttpStatus.BAD_REQUEST);
    }

    // Validation: user is not already a participant
    if (fight.participants.some((p) => p.userId === userId)) {
      logger.warn(LOG_EVENTS.FIGHT_JOIN_REJECTED, 'User already in fight', {
        fightId,
        userId,
        reasonCode: FIGHT_JOIN_REJECTION.ALREADY_PARTICIPANT,
      });
      throw new HttpException(FIGHT_JOIN_REJECTION.ALREADY_PARTICIPANT, HttpStatus.BAD_REQUEST);
    }

    // Validation: opponent slot is free (should only be 1 participant)
    if (fight.participants.length >= 2) {
      logger.warn(LOG_EVENTS.FIGHT_JOIN_REJECTED, 'Fight is full', {
        fightId,
        userId,
        reasonCode: FIGHT_JOIN_REJECTION.FIGHT_FULL,
      });
      throw new HttpException(FIGHT_JOIN_REJECTION.FIGHT_FULL, HttpStatus.BAD_REQUEST);
    }

    // Validation: user has Pacifica connection
    const connection = await prisma.pacificaConnection.findUnique({
      where: { userId },
      select: { isActive: true },
    });

    if (!connection?.isActive) {
      logger.warn(LOG_EVENTS.FIGHT_JOIN_REJECTED, 'No Pacifica connection', {
        fightId,
        userId,
        reasonCode: FIGHT_JOIN_REJECTION.NO_PACIFICA_CONNECTION,
      });
      throw new HttpException(
        FIGHT_JOIN_REJECTION.NO_PACIFICA_CONNECTION,
        HttpStatus.BAD_REQUEST
      );
    }

    // All validations passed - join the fight
    const now = new Date();
    const endedAt = new Date(now.getTime() + fight.durationMinutes * 60 * 1000);

    const updatedFight = await prisma.$transaction(async (tx) => {
      // Add participant B
      await tx.fightParticipant.create({
        data: {
          fightId: fight.id,
          userId,
          slot: 'B',
        },
      });

      // Update fight to LIVE
      return tx.fight.update({
        where: { id: fight.id },
        data: {
          status: FightStatus.LIVE,
          startedAt: now,
          endedAt: endedAt,
        },
        include: {
          participants: {
            include: { user: true },
          },
          creator: true,
        },
      });
    });

    logger.info(LOG_EVENTS.FIGHT_JOIN_SUCCESS, 'Joined fight successfully', {
      fightId,
      userId,
    });

    logger.info(LOG_EVENTS.FIGHT_START, 'Fight started', {
      fightId,
      duration: fight.durationMinutes,
      stake: fight.stakeUsdc,
      startedAt: now.toISOString(),
      endedAt: endedAt.toISOString(),
    });

    // Notify realtime server for arena updates (fight started)
    notifyRealtime('fight-started', fightId);

    return updatedFight;
  }

  /**
   * Get fight by ID with participants
   */
  async getFight(fightId: string) {
    return prisma.fight.findUnique({
      where: { id: fightId },
      include: {
        participants: {
          include: { user: true },
        },
        creator: true,
      },
    });
  }

  /**
   * List fights with filters
   */
  async listFights(params: {
    status?: FightStatus;
    page?: number;
    pageSize?: number;
  }) {
    const page = params.page || 1;
    const pageSize = params.pageSize || 20;
    const skip = (page - 1) * pageSize;

    const where = params.status ? { status: params.status } : {};

    const [fights, total] = await Promise.all([
      prisma.fight.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
        include: {
          participants: {
            include: { user: true },
          },
          creator: true,
        },
      }),
      prisma.fight.count({ where }),
    ]);

    return {
      fights,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    };
  }

  /**
   * Get fights for a specific user
   */
  async getUserFights(userId: string, status?: FightStatus) {
    return prisma.fight.findMany({
      where: {
        participants: {
          some: { userId },
        },
        ...(status && { status }),
      },
      orderBy: { createdAt: 'desc' },
      include: {
        participants: {
          include: { user: true },
        },
        creator: true,
      },
    });
  }

  /**
   * Cancel a fight (only creator can cancel, only WAITING fights can be cancelled)
   */
  async cancelFight(fightId: string, userId: string) {
    updateContext({ fightId, userId });

    logger.info(LOG_EVENTS.FIGHT_JOIN_ATTEMPT, 'Attempting to cancel fight', {
      fightId,
      userId,
    });

    // Get fight
    const fight = await prisma.fight.findUnique({
      where: { id: fightId },
    });

    // Validation: fight exists
    if (!fight) {
      throw new HttpException('Fight not found', HttpStatus.NOT_FOUND);
    }

    // Validation: user is the creator
    if (fight.creatorId !== userId) {
      throw new HttpException('Only the creator can cancel a fight', HttpStatus.FORBIDDEN);
    }

    // Validation: fight is in WAITING status
    if (fight.status !== FightStatus.WAITING) {
      throw new HttpException('Only waiting fights can be cancelled', HttpStatus.BAD_REQUEST);
    }

    // Cancel the fight
    const cancelledFight = await prisma.$transaction(async (tx) => {
      // Delete participants
      await tx.fightParticipant.deleteMany({
        where: { fightId },
      });

      // Delete the fight
      await tx.fight.delete({
        where: { id: fightId },
      });

      return { id: fightId };
    });

    logger.info(LOG_EVENTS.FIGHT_FINISH, 'Fight cancelled', {
      fightId,
      userId,
    });

    // Notify realtime server for arena updates
    notifyRealtime('fight-deleted', fightId);

    return cancelledFight;
  }
}
