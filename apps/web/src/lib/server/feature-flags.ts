/**
 * Feature Flags for Staging/Production Safety
 *
 * These flags allow instant pause of critical operations without code deployment.
 * Set via environment variables.
 */

export const FeatureFlags = {
  /**
   * Enable/disable deposits
   * Set FEATURE_DEPOSITS_ENABLED=false to pause
   */
  isDepositsEnabled: () => process.env.FEATURE_DEPOSITS_ENABLED !== 'false',

  /**
   * Enable/disable fight/pool creation
   * Set FEATURE_POOL_CREATION_ENABLED=false to pause
   */
  isPoolCreationEnabled: () => process.env.FEATURE_POOL_CREATION_ENABLED !== 'false',

  /**
   * Enable/disable fight settlement
   * Set FEATURE_SETTLEMENT_ENABLED=false to pause
   */
  isSettlementEnabled: () => process.env.FEATURE_SETTLEMENT_ENABLED !== 'false',

  /**
   * Enable wallet allowlist (restrict to specific wallets)
   * Set FEATURE_WALLET_ALLOWLIST_ENABLED=true to enable
   */
  isWalletAllowlistEnabled: () => process.env.FEATURE_WALLET_ALLOWLIST_ENABLED === 'true',

  /**
   * Enable trading during fights
   * Set FEATURE_TRADING_ENABLED=false to pause all trades
   */
  isTradingEnabled: () => process.env.FEATURE_TRADING_ENABLED !== 'false',
};

/**
 * Wallet Allowlist
 * Only used when FEATURE_WALLET_ALLOWLIST_ENABLED=true
 */
const ALLOWED_WALLETS = process.env.ALLOWED_WALLETS?.split(',').map((w) => w.trim()) || [];

export function isWalletAllowed(walletAddress: string): boolean {
  if (!FeatureFlags.isWalletAllowlistEnabled()) {
    return true; // Allowlist disabled, all wallets allowed
  }
  return ALLOWED_WALLETS.includes(walletAddress);
}

/**
 * Stake Limits
 */
export const StakeLimits = {
  maxPerUser: () => parseFloat(process.env.MAX_STAKE_PER_USER_USDC || '1000'),
  maxPerFight: () => parseFloat(process.env.MAX_STAKE_PER_FIGHT_USDC || '500'),
};

/**
 * Check if we're in staging environment
 */
export function isStaging(): boolean {
  return process.env.NODE_ENV === 'staging' || process.env.VERCEL_ENV === 'preview';
}

/**
 * Get environment name for display
 */
export function getEnvironmentName(): string {
  if (process.env.NODE_ENV === 'production') return 'production';
  if (process.env.NODE_ENV === 'staging') return 'staging';
  return 'development';
}
