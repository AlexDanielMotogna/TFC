'use client';

import { useMyPrizes } from '@/hooks/useMyPrizes';
import { ClaimPrizeButton } from './ClaimPrizeButton';
import EmojiEventsIcon from '@mui/icons-material/EmojiEvents';

export function UserPrizesSection() {
  const {
    prizes,
    isLoading,
    error,
    claimingPrizeId,
    claimPrize,
    claimablePrizes,
    totalClaimable,
    totalClaimed,
  } = useMyPrizes();

  // Don't render if no prizes
  if (!isLoading && prizes.length === 0) {
    return null;
  }

  // Loading state
  if (isLoading) {
    return (
      <div className="card p-6 mb-6">
        <div className="flex items-center gap-3 mb-4">
          <EmojiEventsIcon sx={{ color: '#f97316', fontSize: 24 }} />
          <h2 className="font-display text-sm font-semibold uppercase tracking-wide text-surface-300">
            Your Prizes
          </h2>
        </div>
        <div className="animate-pulse space-y-3">
          <div className="h-24 bg-surface-800 rounded-xl" />
          <div className="h-24 bg-surface-800 rounded-xl" />
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="card p-6 mb-6">
        <div className="flex items-center gap-3 mb-4">
          <EmojiEventsIcon sx={{ color: '#f97316', fontSize: 24 }} />
          <h2 className="font-display text-sm font-semibold uppercase tracking-wide text-surface-300">
            Your Prizes
          </h2>
        </div>
        <p className="text-surface-400 text-center py-4">{error}</p>
      </div>
    );
  }

  return (
    <div className="card p-6 mb-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <EmojiEventsIcon sx={{ color: '#f97316', fontSize: 24 }} />
          <h2 className="font-display text-sm font-semibold uppercase tracking-wide text-surface-300">
            Your Prizes
          </h2>
        </div>
        <div className="flex items-center gap-6 text-sm">
          {totalClaimable > 0 && (
            <div>
              <span className="text-surface-500">Claimable: </span>
              <span className="text-primary-400 font-semibold">${totalClaimable.toFixed(2)}</span>
            </div>
          )}
          {totalClaimed > 0 && (
            <div>
              <span className="text-surface-500">Total Claimed: </span>
              <span className="text-win-400 font-semibold">${totalClaimed.toFixed(2)}</span>
            </div>
          )}
        </div>
      </div>

      {/* Claimable prizes banner */}
      {claimablePrizes.length > 0 && (
        <div className="mb-4 p-3 bg-primary-500/10 border border-primary-500/30 rounded-lg flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-primary-400">
              You have {claimablePrizes.length} prize{claimablePrizes.length > 1 ? 's' : ''} ready to claim!
            </span>
          </div>
          <span className="text-primary-400 font-bold">${totalClaimable.toFixed(2)} USDC</span>
        </div>
      )}

      {/* Prize list */}
      <div className="space-y-3">
        {prizes.map((prize) => (
          <ClaimPrizeButton
            key={prize.id}
            prize={prize}
            onClaim={claimPrize}
            isClaiming={claimingPrizeId === prize.id}
          />
        ))}
      </div>
    </div>
  );
}

export default UserPrizesSection;
