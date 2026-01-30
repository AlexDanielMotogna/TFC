import { createHash } from 'crypto'

/**
 * Generates a unique referral code for a user
 * Uses SHA256 hash of userId + salt to ensure uniqueness
 *
 * @param userId - The user's ID
 * @returns A 16-character alphanumeric referral code
 */
export function generateReferralCode(userId: string): string {
  const salt = process.env.REFERRAL_CODE_SALT || 'default_salt'

  const hash = createHash('sha256')
    .update(userId + salt)
    .digest('hex')

  // Return first 16 characters (URL-safe, lowercase hex)
  return hash.substring(0, 16)
}
