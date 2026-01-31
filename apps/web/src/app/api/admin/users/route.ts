/**
 * Admin Users API
 * GET /api/admin/users - List users with pagination and filters
 */
import { withAdminAuth } from '@/lib/server/admin-auth';
import { prisma } from '@/lib/server/db';
import { errorResponse } from '@/lib/server/errors';
import { Prisma } from '@prisma/client';

export async function GET(request: Request) {
  try {
    return withAdminAuth(request, async () => {
      const { searchParams } = new URL(request.url);
      const page = parseInt(searchParams.get('page') || '1', 10);
      const pageSize = parseInt(searchParams.get('pageSize') || '25', 10);
      const search = searchParams.get('search') || '';
      const hasPacifica = searchParams.get('hasPacifica');
      const role = searchParams.get('role') as 'USER' | 'ADMIN' | null;

      // Build where clause
      const where: Prisma.UserWhereInput = {};

      // Search by handle or wallet address
      if (search) {
        where.OR = [
          { handle: { contains: search, mode: 'insensitive' } },
          { walletAddress: { contains: search, mode: 'insensitive' } },
          { id: { contains: search, mode: 'insensitive' } },
        ];
      }

      // Filter by Pacifica connection
      if (hasPacifica === 'true') {
        where.pacificaConnection = { isActive: true };
      } else if (hasPacifica === 'false') {
        where.pacificaConnection = null;
      }

      // Filter by role
      if (role) {
        where.role = role;
      }

      // Fetch users with pagination
      const [users, total] = await Promise.all([
        prisma.user.findMany({
          where,
          include: {
            pacificaConnection: {
              select: { isActive: true, accountAddress: true },
            },
            _count: {
              select: {
                fightParticipants: true,
                trades: true,
              },
            },
          },
          orderBy: { createdAt: 'desc' },
          skip: (page - 1) * pageSize,
          take: pageSize,
        }),
        prisma.user.count({ where }),
      ]);

      // Transform for response
      const transformedUsers = users.map((user) => ({
        id: user.id,
        handle: user.handle,
        walletAddress: user.walletAddress,
        avatarUrl: user.avatarUrl,
        role: user.role,
        createdAt: user.createdAt,
        hasPacifica: user.pacificaConnection?.isActive || false,
        pacificaAddress: user.pacificaConnection?.accountAddress || null,
        fightsCount: user._count.fightParticipants,
        tradesCount: user._count.trades,
      }));

      return Response.json({
        success: true,
        data: transformedUsers,
        pagination: {
          page,
          pageSize,
          total,
          totalPages: Math.ceil(total / pageSize),
        },
      });
    });
  } catch (error) {
    return errorResponse(error);
  }
}
