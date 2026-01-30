/**
 * POST /api/referrals/claim
 * Claim unclaimed referral earnings (minimum $10)
 */

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/server/db'
import { verifyToken } from '@/lib/server/auth'
import { errorResponse, BadRequestError } from '@/lib/server/errors'

// Simple in-memory rate limiting
const claimAttempts = new Map<string, number>()
const RATE_LIMIT_WINDOW = 60 * 1000 // 1 minute
const MIN_PAYOUT_AMOUNT = 10 // $10 minimum

function checkRateLimit(userId: string): boolean {
  const now = Date.now()
  const lastAttempt = claimAttempts.get(userId)

  if (lastAttempt && now - lastAttempt < RATE_LIMIT_WINDOW) {
    return false
  }

  claimAttempts.set(userId, now)
  // Cleanup old entries
  setTimeout(() => claimAttempts.delete(userId), RATE_LIMIT_WINDOW)
  return true
}

export async function POST(request: Request) {
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

    // Rate limiting: 1 request per minute per user
    if (!checkRateLimit(userId)) {
      return NextResponse.json(
        { error: 'Rate limit exceeded. Please wait before claiming again.' },
        { status: 429 }
      )
    }

    // Get user with wallet address
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        handle: true,
        walletAddress: true,
      },
    })

    if (!user || !user.walletAddress) {
      throw new BadRequestError('Wallet address not set. Please connect your wallet first.')
    }

    // Check if there's a pending payout
    const pendingPayout = await prisma.referralPayout.findFirst({
      where: {
        userId,
        status: { in: ['pending', 'processing'] },
      },
    })

    if (pendingPayout) {
      return NextResponse.json(
        {
          error: 'You have a pending payout. Please wait for it to be processed.',
          payoutId: pendingPayout.id,
        },
        { status: 400 }
      )
    }

    // Calculate unclaimed amount
    const unclaimedResult = await prisma.referralEarning.aggregate({
      where: {
        referrerId: userId,
        isPaid: false,
      },
      _sum: { commissionAmount: true },
      _count: true,
    })

    const unclaimedAmount = Number(unclaimedResult._sum.commissionAmount || 0)
    const earningsCount = unclaimedResult._count

    // Check minimum payout amount
    if (unclaimedAmount < MIN_PAYOUT_AMOUNT) {
      return NextResponse.json(
        {
          error: `Minimum payout amount is $${MIN_PAYOUT_AMOUNT}. You have $${unclaimedAmount.toFixed(2)} available.`,
          unclaimedAmount,
          minimumRequired: MIN_PAYOUT_AMOUNT,
        },
        { status: 400 }
      )
    }

    // Create payout record and mark earnings as paid (transaction)
    const payout = await prisma.$transaction(async (tx) => {
      // Create payout record
      const payoutRecord = await tx.referralPayout.create({
        data: {
          userId,
          amount: unclaimedAmount,
          walletAddress: user.walletAddress!,
          status: 'pending',
        },
      })

      // Mark all unpaid earnings as paid
      await tx.referralEarning.updateMany({
        where: {
          referrerId: userId,
          isPaid: false,
        },
        data: {
          isPaid: true,
          paidAt: new Date(),
        },
      })

      return payoutRecord
    })

    console.log('[POST /api/referrals/claim] Payout claimed successfully', {
      userId,
      payoutId: payout.id,
      amount: unclaimedAmount,
      earningsCount,
    })

    return NextResponse.json({
      success: true,
      payout: {
        id: payout.id,
        amount: Number(payout.amount),
        status: payout.status,
        walletAddress: payout.walletAddress,
        createdAt: payout.createdAt.toISOString(),
      },
      earningsClaimed: earningsCount,
      message: `Successfully claimed $${unclaimedAmount.toFixed(2)}. Payout is being processed.`,
    })
  } catch (error) {
    console.error('[POST /api/referrals/claim] Error:', error)
    return errorResponse(error)
  }
}
