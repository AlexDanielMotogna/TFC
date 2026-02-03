/**
 * Admin Realtime Broadcast Helpers
 * Send real-time updates to admin panel subscribers
 */

const REALTIME_URL = process.env.REALTIME_URL || 'http://localhost:3002';
const INTERNAL_API_KEY = process.env.INTERNAL_API_KEY || 'dev-internal-key';

interface AdminBroadcastOptions {
  logOnError?: boolean;
}

async function broadcastAdmin(
  endpoint: string,
  data: unknown,
  options: AdminBroadcastOptions = { logOnError: true }
) {
  try {
    const response = await fetch(`${REALTIME_URL}/internal/admin/${endpoint}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Internal-Key': INTERNAL_API_KEY,
      },
      body: JSON.stringify(data),
    });

    if (!response.ok && options.logOnError) {
      console.error(`[AdminRealtime] Broadcast failed: ${endpoint}`, {
        status: response.status,
        data,
      });
    }
  } catch (error) {
    if (options.logOnError) {
      console.error(`[AdminRealtime] Failed to broadcast: ${endpoint}`, { error });
    }
  }
}

// User events
export async function broadcastUserCreated(user: {
  id: string;
  handle: string;
  walletAddress: string;
  role: string;
  createdAt: Date;
}) {
  await broadcastAdmin('user-event', {
    eventType: 'created',
    user: {
      id: user.id,
      handle: user.handle,
      walletAddress: user.walletAddress,
      role: user.role,
      createdAt: user.createdAt.toISOString(),
      updatedAt: user.createdAt.toISOString(),
    },
  });
}

export async function broadcastUserUpdated(user: {
  id: string;
  handle: string;
  walletAddress: string | null;
  role: string;
  createdAt: Date;
  updatedAt: Date;
}) {
  await broadcastAdmin('user-event', {
    eventType: 'updated',
    user: {
      id: user.id,
      handle: user.handle,
      walletAddress: user.walletAddress || '',
      role: user.role,
      createdAt: user.createdAt.toISOString(),
      updatedAt: user.updatedAt.toISOString(),
    },
  });
}

// Fight events
export async function broadcastAdminFightUpdate(
  eventType: 'created' | 'started' | 'ended' | 'cancelled',
  fight: {
    id: string;
    status: string;
    stakeUsdc: number;
    durationMinutes: number;
    creatorId: string;
    winnerId?: string | null;
    isDraw?: boolean;
    participantA?: { userId: string; handle: string } | null;
    participantB?: { userId: string; handle: string } | null;
    createdAt: Date;
    startedAt?: Date | null;
    endedAt?: Date | null;
  }
) {
  await broadcastAdmin('fight-update', {
    eventType,
    fight: {
      id: fight.id,
      status: fight.status,
      stakeUsdc: fight.stakeUsdc,
      durationMinutes: fight.durationMinutes,
      creatorId: fight.creatorId,
      winnerId: fight.winnerId || null,
      isDraw: fight.isDraw || false,
      participantA: fight.participantA || null,
      participantB: fight.participantB || null,
      createdAt: fight.createdAt.toISOString(),
      startedAt: fight.startedAt?.toISOString() || null,
      endedAt: fight.endedAt?.toISOString() || null,
    },
  });
}

// Trade events
export async function broadcastAdminTrade(trade: {
  id: string;
  fightId: string;
  userId: string;
  userHandle: string;
  symbol: string;
  side: string;
  amount: number;
  price: number;
  fee: number;
  pnl: number | null;
  timestamp: Date;
}) {
  await broadcastAdmin('trade-event', {
    trade: {
      id: trade.id,
      fightId: trade.fightId,
      userId: trade.userId,
      userHandle: trade.userHandle,
      symbol: trade.symbol,
      side: trade.side,
      amount: trade.amount,
      price: trade.price,
      fee: trade.fee,
      pnl: trade.pnl,
      timestamp: trade.timestamp.toISOString(),
    },
  });
}

// Stats update
export async function broadcastAdminStats(stats: {
  totalUsers: number;
  totalFights: number;
  activeFights: number;
  totalTrades: number;
  totalVolume: number;
  totalFees: number;
  fightsByStatus: {
    WAITING: number;
    LIVE: number;
    FINISHED: number;
    CANCELLED: number;
  };
}) {
  await broadcastAdmin('stats', stats);
}

// Job status
export async function broadcastJobStatus(job: {
  name: string;
  status: 'healthy' | 'stale' | 'failed';
  lastRun: string | null;
  message: string;
}) {
  await broadcastAdmin('job-status', job);
}

// Leaderboard
export async function broadcastLeaderboard(data: {
  range: 'weekly' | 'all_time';
  entries: Array<{
    rank: number;
    userId: string;
    handle: string;
    wins: number;
    losses: number;
    totalPnlUsdc: number;
  }>;
}) {
  await broadcastAdmin('leaderboard', data);
}

// Prize pool
export async function broadcastPrizePool(data: {
  pools: Array<{
    id: string;
    name: string;
    totalUsdc: number;
    status: string;
    winnersCount: number;
  }>;
}) {
  await broadcastAdmin('prize-pool', data);
}

// System health
export async function broadcastSystemHealth(data: {
  services: {
    api: { status: 'healthy' | 'degraded' | 'down'; latencyMs?: number };
    realtime: { status: 'healthy' | 'degraded' | 'down'; connections?: number };
    database: { status: 'healthy' | 'degraded' | 'down'; latencyMs?: number };
    pacifica: { status: 'healthy' | 'degraded' | 'down'; latencyMs?: number };
  };
}) {
  await broadcastAdmin('system-health', data);
}
