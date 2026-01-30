/**
 * Referral Service
 * Handles referral registration and chain creation (T1, T2, T3)
 */

import { prisma } from '../db'

/**
 * Process referral registration when a new user signs up with a referral code
 * Creates the full referral chain: T1 (direct), T2 (referrer's referrer), T3 (referrer's referrer's referrer)
 *
 * @param newUserId - The ID of the newly registered user
 * @param referralCode - The referral code they used
 */
export async function processReferralRegistration(
  newUserId: string,
  referralCode: string
): Promise<{ success: boolean; tiersCreated: number }> {
  console.log('Processing referral registration', {
    newUserId,
    referralCode,
  })

  try {
    // Find the referrer by their referral code
    const referrer = await prisma.user.findUnique({
      where: { referralCode },
      select: { id: true, handle: true },
    })

    // Referrer not found or user is trying to refer themselves
    if (!referrer || referrer.id === newUserId) {
      console.log('Referral registration skipped', {
        reason: !referrer ? 'Referrer not found' : 'Self-referral blocked',
        referralCode,
      })
      return { success: false, tiersCreated: 0 }
    }

    // Check if user already has a referrer (prevent changing referrer)
    const existingReferral = await prisma.referral.findFirst({
      where: { referredId: newUserId, tier: 1 },
    })

    if (existingReferral) {
      console.log('User already has a referrer, skipping', {
        newUserId,
        existingReferrer: existingReferral.referrerId,
      })
      return { success: false, tiersCreated: 0 }
    }

    let tiersCreated = 0

    // Create Tier 1 (Direct Referral)
    await prisma.referral.create({
      data: {
        referrerId: referrer.id,
        referredId: newUserId,
        tier: 1,
      },
    })
    tiersCreated++

    // Update user's referredById field
    await prisma.user.update({
      where: { id: newUserId },
      data: { referredById: referrer.id },
    })

    console.log('T1 referral created', {
      referrer: referrer.id,
      referred: newUserId,
    })

    // Find Tier 2 (referrer's referrer)
    const t1Referral = await prisma.referral.findFirst({
      where: { referredId: referrer.id, tier: 1 },
      select: { referrerId: true },
    })

    if (t1Referral) {
      // Create Tier 2 referral
      await prisma.referral.create({
        data: {
          referrerId: t1Referral.referrerId,
          referredId: newUserId,
          tier: 2,
        },
      })
      tiersCreated++

      console.log('T2 referral created', {
        referrer: t1Referral.referrerId,
        referred: newUserId,
      })

      // Find Tier 3 (referrer's referrer's referrer)
      const t2Referral = await prisma.referral.findFirst({
        where: { referredId: t1Referral.referrerId, tier: 1 },
        select: { referrerId: true },
      })

      if (t2Referral) {
        // Create Tier 3 referral
        await prisma.referral.create({
          data: {
            referrerId: t2Referral.referrerId,
            referredId: newUserId,
            tier: 3,
          },
        })
        tiersCreated++

        console.log('T3 referral created', {
          referrer: t2Referral.referrerId,
          referred: newUserId,
        })
      }
    }

    console.log('Referral registration completed', {
      newUserId,
      tiersCreated,
    })

    return { success: true, tiersCreated }
  } catch (error) {
    console.error('Referral registration failed', error, {
      newUserId,
      referralCode,
    })
    // Don't throw - referral failure shouldn't block user registration
    return { success: false, tiersCreated: 0 }
  }
}

/**
 * Check if a referral code is valid
 */
export async function isValidReferralCode(referralCode: string): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { referralCode },
    select: { id: true },
  })

  return !!user
}

/**
 * Get user's referral stats
 */
export async function getUserReferralStats(userId: string) {
  const [t1Count, t2Count, t3Count] = await Promise.all([
    prisma.referral.count({ where: { referrerId: userId, tier: 1 } }),
    prisma.referral.count({ where: { referrerId: userId, tier: 2 } }),
    prisma.referral.count({ where: { referrerId: userId, tier: 3 } }),
  ])

  return {
    t1: t1Count,
    t2: t2Count,
    t3: t3Count,
    total: t1Count + t2Count + t3Count,
  }
}

/**
 * Calculate and create referral commissions for a trade
 * Finds all referrers (T1, T2, T3) for the trader and creates commission earnings
 *
 * @param tradeId - The ID of the trade
 * @param traderId - The user who made the trade
 * @param symbol - Trading symbol
 * @param tradeFee - Fee paid on the trade
 * @param tradeValue - Total value of the trade (amount * price)
 */
export async function calculateReferralCommissions(params: {
  tradeId: string
  traderId: string
  symbol: string
  tradeFee: string | number
  tradeValue: string | number
}): Promise<{ earningsCreated: number }> {
  const { tradeId, traderId, symbol, tradeFee, tradeValue } = params

  try {
    // Import config here to avoid circular dependency
    const { getReferralCommissionRates } = await import('../referral-config')

    // Find all referrers for this trader (T1, T2, T3)
    const referrals = await prisma.referral.findMany({
      where: { referredId: traderId },
      select: { referrerId: true, tier: true },
    })

    if (referrals.length === 0) {
      // Trader has no referrers, no commissions to create
      return { earningsCreated: 0 }
    }

    // Get commission rates from env vars
    const commissionRates = getReferralCommissionRates()

    // Convert fee and value to numbers
    const feeNum = typeof tradeFee === 'string' ? parseFloat(tradeFee) : tradeFee
    const valueNum = typeof tradeValue === 'string' ? parseFloat(tradeValue) : tradeValue

    let earningsCreated = 0

    // Create commission earnings for each referrer
    for (const referral of referrals) {
      const commissionRate = commissionRates[referral.tier as 1 | 2 | 3]
      const commissionAmount = feeNum * commissionRate

      await prisma.referralEarning.create({
        data: {
          referrerId: referral.referrerId,
          traderId,
          tradeId,
          tier: referral.tier,
          symbol,
          tradeFee: feeNum,
          tradeValue: valueNum,
          commissionPercent: commissionRate * 100, // Store as percentage (e.g., 34.00)
          commissionAmount,
          isPaid: false,
        },
      })

      earningsCreated++

      console.log('[calculateReferralCommissions] Commission created', {
        referrer: referral.referrerId,
        trader: traderId,
        tier: referral.tier,
        tradeFee: feeNum,
        commissionRate: `${commissionRate * 100}%`,
        commissionAmount,
      })
    }

    console.log('[calculateReferralCommissions] Completed', {
      tradeId,
      traderId,
      earningsCreated,
    })

    return { earningsCreated }
  } catch (error) {
    console.error('[calculateReferralCommissions] Failed', error, {
      tradeId,
      traderId,
    })
    // Don't throw - commission failure shouldn't block trade
    return { earningsCreated: 0 }
  }
}
