/**
 * GET /api/referrals/dashboard
 * Returns all referral data for the authenticated user's dashboard
 */

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/server/db'
import { verifyToken } from '@/lib/server/auth'
import { getReferralCommissionRatesDisplay } from '@/lib/server/referral-config'
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

    // Get user with referral code
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { referralCode: true },
    })

    if (!user || !user.referralCode) {
      return NextResponse.json(
        { error: 'User not found or referral code not generated' },
        { status: 404 }
      )
    }

    // Get commission rates from env
    const commissionRates = getReferralCommissionRatesDisplay()

    // Get total referrals by tier
    const [t1Referrals, t2Referrals, t3Referrals] = await Promise.all([
      prisma.referral.count({ where: { referrerId: userId, tier: 1 } }),
      prisma.referral.count({ where: { referrerId: userId, tier: 2 } }),
      prisma.referral.count({ where: { referrerId: userId, tier: 3 } }),
    ])

    // Get total earnings by tier
    const earningsAggregation = await prisma.referralEarning.groupBy({
      by: ['tier'],
      where: { referrerId: userId },
      _sum: { commissionAmount: true },
    })

    const earningsByTier = {
      t1: 0,
      t2: 0,
      t3: 0,
    }

    earningsAggregation.forEach((item) => {
      const tierKey = `t${item.tier}` as 't1' | 't2' | 't3'
      earningsByTier[tierKey] = Number(item._sum.commissionAmount || 0)
    })

    const totalEarnings = earningsByTier.t1 + earningsByTier.t2 + earningsByTier.t3

    // Get unclaimed payout (earnings that haven't been paid)
    const unclaimedResult = await prisma.referralEarning.aggregate({
      where: {
        referrerId: userId,
        isPaid: false,
      },
      _sum: { commissionAmount: true },
    })

    const unclaimedPayout = Number(unclaimedResult._sum.commissionAmount || 0)

    // Get referral trading volume by tier
    const volumeByTier = await Promise.all([
      prisma.$queryRaw<[{ volume: number }]>`
        SELECT COALESCE(SUM(CAST(re.trade_value AS DECIMAL)), 0) as volume
        FROM referral_earnings re
        WHERE re.referrer_id = ${userId}::uuid AND re.tier = 1
      `,
      prisma.$queryRaw<[{ volume: number }]>`
        SELECT COALESCE(SUM(CAST(re.trade_value AS DECIMAL)), 0) as volume
        FROM referral_earnings re
        WHERE re.referrer_id = ${userId}::uuid AND re.tier = 2
      `,
      prisma.$queryRaw<[{ volume: number }]>`
        SELECT COALESCE(SUM(CAST(re.trade_value AS DECIMAL)), 0) as volume
        FROM referral_earnings re
        WHERE re.referrer_id = ${userId}::uuid AND re.tier = 3
      `,
    ])

    const referralVolume = {
      t1: volumeByTier[0]?.[0]?.volume || 0,
      t2: volumeByTier[1]?.[0]?.volume || 0,
      t3: volumeByTier[2]?.[0]?.volume || 0,
      total: (volumeByTier[0]?.[0]?.volume || 0) + (volumeByTier[1]?.[0]?.volume || 0) + (volumeByTier[2]?.[0]?.volume || 0),
    }

    // Get recent referrals (last 10)
    const recentReferrals = await prisma.referral.findMany({
      where: { referrerId: userId },
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
      take: 10,
    })

    // Get recent earnings (last 20)
    const recentEarnings = await prisma.referralEarning.findMany({
      where: { referrerId: userId },
      orderBy: { earnedAt: 'desc' },
      take: 20,
      select: {
        id: true,
        tier: true,
        symbol: true,
        commissionAmount: true,
        earnedAt: true,
        isPaid: true,
      },
    })

    // Get payout history
    const payoutHistory = await prisma.referralPayout.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 20,
      select: {
        id: true,
        amount: true,
        status: true,
        walletAddress: true,
        txSignature: true,
        createdAt: true,
        processedAt: true,
      },
    })

    return NextResponse.json({
      referralCode: user.referralCode,
      commissionRates,
      unclaimedPayout,
      totalReferrals: {
        t1: t1Referrals,
        t2: t2Referrals,
        t3: t3Referrals,
        total: t1Referrals + t2Referrals + t3Referrals,
      },
      totalEarnings: {
        total: totalEarnings,
        t1: earningsByTier.t1,
        t2: earningsByTier.t2,
        t3: earningsByTier.t3,
      },
      referralVolume,
      recentReferrals: recentReferrals.map((ref) => ({
        id: ref.id,
        tier: ref.tier,
        user: {
          id: ref.referred.id,
          handle: ref.referred.handle,
          walletAddress: ref.referred.walletAddress,
        },
        joinedAt: ref.createdAt.toISOString(),
      })),
      recentEarnings,
      payoutHistory,
    })
  } catch (error) {
    console.error('[GET /api/referrals/dashboard] Error:', error)
    return errorResponse(error)
  }
}
