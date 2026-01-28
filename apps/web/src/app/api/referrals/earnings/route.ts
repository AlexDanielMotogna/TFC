/**
 * GET /api/referrals/earnings?page=1&pageSize=50&tier=1&isPaid=false
 * Returns paginated list of referral earnings
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
    const pageSize = Math.min(parseInt(url.searchParams.get('pageSize') || '50'), 100)
    const tierFilter = url.searchParams.get('tier') // Optional: 1, 2, or 3
    const isPaidFilter = url.searchParams.get('isPaid') // Optional: 'true' or 'false'
    const skip = (page - 1) * pageSize

    // Build where clause
    const where: any = { referrerId: userId }

    if (tierFilter && ['1', '2', '3'].includes(tierFilter)) {
      where.tier = parseInt(tierFilter)
    }

    if (isPaidFilter && ['true', 'false'].includes(isPaidFilter)) {
      where.isPaid = isPaidFilter === 'true'
    }

    // Get total count
    const totalCount = await prisma.referralEarning.count({ where })

    // Get earnings with trader info
    const earnings = await prisma.referralEarning.findMany({
      where,
      include: {
        referrer: {
          select: {
            handle: true,
          },
        },
      },
      orderBy: { earnedAt: 'desc' },
      skip,
      take: pageSize,
    })

    // Get trader handles
    const traderIds = [...new Set(earnings.map((e) => e.traderId))]
    const traders = await prisma.user.findMany({
      where: { id: { in: traderIds } },
      select: { id: true, handle: true },
    })

    const traderMap = new Map(traders.map((t) => [t.id, t.handle]))

    const earningsWithDetails = earnings.map((earning) => ({
      id: earning.id,
      tier: earning.tier,
      symbol: earning.symbol,
      trader: {
        id: earning.traderId,
        handle: traderMap.get(earning.traderId) || 'Unknown',
      },
      tradeFee: Number(earning.tradeFee),
      tradeValue: Number(earning.tradeValue),
      commissionPercent: Number(earning.commissionPercent),
      commissionAmount: Number(earning.commissionAmount),
      earnedAt: earning.earnedAt.toISOString(),
      isPaid: earning.isPaid,
      paidAt: earning.paidAt?.toISOString() || null,
    }))

    return NextResponse.json({
      earnings: earningsWithDetails,
      pagination: {
        page,
        pageSize,
        totalCount,
        totalPages: Math.ceil(totalCount / pageSize),
      },
    })
  } catch (error) {
    console.error('[GET /api/referrals/earnings] Error:', error)
    return errorResponse(error)
  }
}
