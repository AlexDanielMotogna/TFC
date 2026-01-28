'use client'

import { useEffect } from 'react'
import { useSearchParams } from 'next/navigation'

const REFERRAL_CODE_KEY = 'tfc_referral_code'

/**
 * Hook to track referral codes from URL parameters
 * Captures ?ref=CODE and stores it in localStorage
 *
 * Usage: Call this hook in your root layout or app component
 */
export function useReferralTracking() {
  const searchParams = useSearchParams()

  useEffect(() => {
    // Get referral code from URL
    const refCode = searchParams?.get('ref')

    if (refCode) {
      try {
        // Store in localStorage
        localStorage.setItem(REFERRAL_CODE_KEY, refCode)
        console.log('Referral code stored:', refCode)
      } catch (error) {
        console.error('Failed to store referral code:', error)
      }
    }
  }, [searchParams])
}

/**
 * Get the stored referral code from localStorage
 * Returns null if no referral code is stored
 */
export function getStoredReferralCode(): string | null {
  if (typeof window === 'undefined') return null

  try {
    return localStorage.getItem(REFERRAL_CODE_KEY)
  } catch (error) {
    console.error('Failed to get referral code:', error)
    return null
  }
}

/**
 * Clear the stored referral code (after successful registration)
 */
export function clearStoredReferralCode(): void {
  if (typeof window === 'undefined') return

  try {
    localStorage.removeItem(REFERRAL_CODE_KEY)
    console.log('Referral code cleared')
  } catch (error) {
    console.error('Failed to clear referral code:', error)
  }
}
