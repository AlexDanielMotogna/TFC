'use client';

import { useReferralTracking } from '@/lib/hooks/useReferralTracking';

/**
 * Component that tracks referral codes from URL parameters
 * Mount this in the app providers to capture ?ref=CODE across all pages
 */
export function ReferralTracker() {
  useReferralTracking();
  return null;
}
