/**
 * GET /api/referrals/list?page=1&pageSize=25&tier=1
 * Returns paginated list of referrals with trade stats
 */

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/server/db'
import { verifyToken } from '@/lib/server/auth'
import { errorResponse } from '@/lib/server/errors'

export async function GET(request: Request) {
  try {
    // Get user from auth token
    const authHeader = request.headers.get('Authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const token = authHeader.substring(7)
    const payload = await verifyToken(token)
    if (!payload) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 })
    }

    const userId = payload.sub

    // Parse query parameters
    const url = new URL(request.url)
    const page = parseInt(url.searchParams.get('page') || '1')
    const pageSize = Math.min(parseInt(url.searchParams.get('pageSize') || '25'), 100) // Max 100
    const tierFilter = url.searchParams.get('tier') // Optional: 1, 2, or 3
    const skip = (page - 1) * pageSize

    // Build where clause
    const where: any = { referrerId: userId }
    if (tierFilter && ['1', '2', '3'].includes(tierFilter)) {
      where.tier = parseInt(tierFilter)
    }

    // Get total count
    const totalCount = await prisma.referral.count({ where })

    // Get referrals with user info
    const referrals = await prisma.referral.findMany({
      where,
      include: {
        referred: {
          select: {
            id: true,
            handle: true,
            walletAddress: true,
            createdAt: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: pageSize,
    })

    // Get trade stats for each referred user
    const referralsWithStats = await Promise.all(
      referrals.map(async (ref) => {
        // Get trade count and volume for this referral
        const [tradesCount, volumeResult, earningsResult] = await Promise.all([
          prisma.trade.count({ where: { userId: ref.referredId } }),
          prisma.$queryRaw<[{ volume: number }]>`
            SELECT COALESCE(SUM(CAST(amount AS DECIMAL) * CAST(price AS DECIMAL)), 0) as volume
            FROM trades
            WHERE user_id = ${ref.referredId}::uuid
          `,
          prisma.referralEarning.aggregate({
            where: {
              referrerId: userId,
              traderId: ref.referredId,
              tier: ref.tier,
            },
            _sum: { commissionAmount: true },
          }),
        ])

        return {
          id: ref.id,
          tier: ref.tier,
          user: {
            id: ref.referred.id,
            handle: ref.referred.handle,
            walletAddress: ref.referred.walletAddress,
          },
          joinedAt: ref.createdAt.toISOString(),
          stats: {
            totalTrades: tradesCount,
            totalVolume: volumeResult[0]?.volume || 0,
            totalEarnings: Number(earningsResult._sum.commissionAmount || 0),
          },
        }
      })
    )

    return NextResponse.json({
      referrals: referralsWithStats,
      pagination: {
        page,
        pageSize,
        totalCount,
        totalPages: Math.ceil(totalCount / pageSize),
      },
    })
  } catch (error) {
    console.error('[GET /api/referrals/list] Error:', error)
    return errorResponse(error)
  }
}
