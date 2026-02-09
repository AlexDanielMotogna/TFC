'use client';

import { useEffect, useState } from 'react';
import { useMyPrizes, type UserPrize } from '@/hooks/useMyPrizes';
import { useAuth } from '@/hooks';
import { AppShell } from '@/components/AppShell';
import { BetaGate } from '@/components/BetaGate';
import EmojiEventsIcon from '@mui/icons-material/EmojiEvents';
import WorkspacePremiumIcon from '@mui/icons-material/WorkspacePremium';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import CircularProgress from '@mui/material/CircularProgress';

// Medal colors by rank
const RANK_STYLES: Record<number, { medal: string; text: string; bg: string }> = {
  1: { medal: '#facc15', text: 'text-amber-400', bg: 'bg-amber-500/10' },
  2: { medal: '#cbd5e1', text: 'text-slate-300', bg: 'bg-slate-400/10' },
  3: { medal: '#d97706', text: 'text-orange-400', bg: 'bg-orange-500/10' },
};

const DEFAULT_RANK_STYLE = { medal: '#d97706', text: 'text-orange-400', bg: 'bg-orange-500/10' };

// Format rank with ordinal suffix
const formatRank = (rank: number): string => {
  switch (rank) {
    case 1: return '1st';
    case 2: return '2nd';
    case 3: return '3rd';
    default: return `${rank}th`;
  }
};

// Format week dates
const formatWeekLabel = (startDate: string, endDate: string): string => {
  const weekStart = new Date(startDate);
  const weekEnd = new Date(endDate);
  return `${weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${weekEnd.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
};

// Prize row component
function PrizeRow({
  prize,
  onClaim,
  isClaiming,
  index,
}: {
  prize: UserPrize;
  onClaim: (prizeId: string) => Promise<{
    success: boolean;
    txSignature?: string;
    explorerUrl?: string;
    error?: string;
  }>;
  isClaiming: boolean;
  index: number;
}) {
  const [claimResult, setClaimResult] = useState<{
    success: boolean;
    txSignature?: string;
    explorerUrl?: string;
    error?: string;
  } | null>(null);

  const style = RANK_STYLES[prize.rank] ?? DEFAULT_RANK_STYLE;
  const weekLabel = formatWeekLabel(prize.weekStartDate, prize.weekEndDate);

  const handleClaim = async () => {
    setClaimResult(null);
    const result = await onClaim(prize.id);
    setClaimResult(result);
  };

  return (
    <tr className={`transition-colors ${index % 2 === 0 ? 'bg-surface-800/30' : ''} hover:bg-surface-800/50`}>
      {/* Rank */}
      <td className="py-4 px-4">
        <div className="flex items-center gap-2">
          <WorkspacePremiumIcon sx={{ color: style.medal, fontSize: 24 }} />
          <span className={`font-bold ${style.text}`}>{formatRank(prize.rank)} Place</span>
        </div>
      </td>

      {/* Period */}
      <td className="py-4 px-4 text-surface-400 text-xs whitespace-nowrap">
        {weekLabel}
      </td>

      {/* Amount */}
      <td className="py-4 px-4 text-right">
        <span className="text-sm font-bold text-white">${prize.amount.toFixed(2)}</span>
      </td>

      {/* Status */}
      <td className="py-4 px-4 text-center">
        {prize.status === 'DISTRIBUTED' ? (
          <span className="inline-flex items-center gap-2.5 px-2.5 py-1 rounded-full bg-win-500/10 text-win-400 text-xs font-medium">
            <CheckCircleIcon sx={{ fontSize: 14 }} />
            Claimed
          </span>
        ) : prize.status === 'PENDING' ? (
          <span className="px-2.5 py-1 rounded-full bg-surface-700 text-surface-400 text-xs font-medium">
            Pending
          </span>
        ) : (
          <span className="px-2.5 py-1 rounded-full bg-primary-500/10 text-primary-400 text-xs font-medium">
            Ready
          </span>
        )}
      </td>

      {/* Action */}
      <td className="py-4 px-4 text-right">
        {prize.status === 'DISTRIBUTED' && prize.txSignature ? (
          <a
            href={`https://solscan.io/tx/${prize.txSignature}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2.5 text-primary-400 hover:text-primary-300 transition-colors text-sm"
          >
            <span className="font-mono">{prize.txSignature.slice(0, 6)}...</span>
            <OpenInNewIcon sx={{ fontSize: 14 }} />
          </a>
        ) : prize.status === 'PENDING' ? (
          <span className="text-xs text-surface-500">After week ends</span>
        ) : claimResult?.success ? (
          <div className="flex items-center justify-end gap-2.5 text-win-400 text-sm">
            <CheckCircleIcon sx={{ fontSize: 16 }} />
            <span>Done!</span>
          </div>
        ) : (
          <div className="flex flex-col items-end gap-2">
            {claimResult && !claimResult.success && (
              <span className="text-xs text-loss-400">{claimResult.error}</span>
            )}
            <button
              onClick={handleClaim}
              disabled={isClaiming}
              className="px-4 py-1.5 bg-gradient-to-r from-primary-500 to-primary-600 hover:from-primary-600 hover:to-primary-700 disabled:from-surface-600 disabled:to-surface-700 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-lg transition-all flex items-center gap-2"
            >
              {isClaiming ? (
                <>
                  <CircularProgress size={14} color="inherit" />
                  <span>Claiming...</span>
                </>
              ) : (
                <span>Claim</span>
              )}
            </button>
          </div>
        )}
      </td>
    </tr>
  );
}

export default function RewardsPage() {
  const { isAuthenticated, user } = useAuth();
  const {
    prizes,
    isLoading,
    error,
    claimingPrizeId,
    claimPrize,
    totalClaimable,
    totalClaimed,
  } = useMyPrizes();

  const [prizesToShow, setPrizesToShow] = useState(10);
  const [currentStanding, setCurrentStanding] = useState<{
    rank: number | null;
    estimatedPrize: number;
  }>({ rank: null, estimatedPrize: 0 });
  const [isLoadingStanding, setIsLoadingStanding] = useState(false);

  // Fetch current weekly standing
  useEffect(() => {
    if (!isAuthenticated || !user) {
      console.log('[Rewards] Not fetching standing - not authenticated or no user');
      return;
    }

    const fetchCurrentStanding = async () => {
      console.log('[Rewards] Fetching current standing for user:', user.id);
      console.log('[Rewards] Full user object:', user);
      setIsLoadingStanding(true);
      try {
        // Get leaderboard to find user's rank
        const leaderboardRes = await fetch('/api/leaderboard?range=weekly&limit=100');
        const leaderboardData = await leaderboardRes.json();
        console.log('[Rewards] Leaderboard data:', leaderboardData);

        if (leaderboardData.success) {
          const entries = leaderboardData.data.entries || [];
          console.log('[Rewards] All entries:', entries);
          console.log('[Rewards] Looking for userId:', user.id);
          console.log('[Rewards] First 3 entry userIds:', entries.slice(0, 3).map((e: any) => ({ userId: e.userId, handle: e.handle })));

          const userEntry = entries.find((e: any) => {
            const match = e.userId === user.id;
            if (match) console.log('[Rewards] MATCH FOUND:', e);
            return match;
          });
          console.log('[Rewards] User entry in leaderboard:', userEntry);

          if (userEntry) {
            // Get prize pool to calculate estimated prize
            const prizePoolRes = await fetch('/api/prize-pool');
            const prizePoolData = await prizePoolRes.json();
            console.log('[Rewards] Prize pool data:', prizePoolData);

            let estimatedPrize = 0;
            if (prizePoolData.success && prizePoolData.data) {
              const totalFees = prizePoolData.data.totalFeesCollected;
              const rank = userEntry.rank;

              // Calculate based on rank (5% for 1st, 3% for 2nd, 2% for 3rd)
              if (rank === 1) estimatedPrize = totalFees * 0.05;
              else if (rank === 2) estimatedPrize = totalFees * 0.03;
              else if (rank === 3) estimatedPrize = totalFees * 0.02;
            }

            console.log('[Rewards] Setting current standing:', { rank: userEntry.rank, estimatedPrize });
            setCurrentStanding({ rank: userEntry.rank, estimatedPrize });
          } else {
            console.log('[Rewards] User not found in leaderboard');
            setCurrentStanding({ rank: null, estimatedPrize: 0 });
          }
        }
      } catch (err) {
        console.error('[Rewards] Failed to fetch current standing:', err);
      } finally {
        setIsLoadingStanding(false);
      }
    };

    fetchCurrentStanding();
  }, [isAuthenticated, user]);

  // Set page title
  useEffect(() => {
    document.title = 'Rewards - Trading Fight Club';
  }, []);

  // Not authenticated state
  if (!isAuthenticated) {
    return (
      <BetaGate>
        <AppShell>
          <div className="container mx-auto px-2 2xl:px-6 py-8">
            <div className="card p-12 border-x-0 22xl:border-x border-y 2xl:border border-surface-800 text-center mx-0 2xl:mx-0">
              <EmojiEventsIcon sx={{ fontSize: 64, color: '#52525b', marginBottom: 16 }} />
              <h3 className="text-sm sm:text-lg font-semibold text-surface-300 mb-2">Connect your wallet</h3>
              <p className="text-surface-500">Please connect your wallet to view your rewards.</p>
            </div>
          </div>
        </AppShell>
      </BetaGate>
    );
  }

  return (
    <BetaGate>
      <AppShell>
        <div className="max-w-full 2xl:container mx-auto px-0 2xl:px-6 py-8">
          {/* Header */}
          <div className="flex items-center gap-2 sm:gap-3 mb-2 px-2 2xl:px-0">
            <EmojiEventsIcon sx={{ color: '#f97316', fontSize: 28 }} />
            <div>
              <h1 className="font-display text-sm sm:text-2xl font-bold text-white">Rewards</h1>
              <p className="text-surface-400 text-xs sm:text-sm">Claim your weekly prizes</p>
            </div>
          </div>

          {/* Stats Cards */}
          {!isLoading && !error && prizes.length > 0 && (
            <div className="grid grid-cols-1 2xl:grid-cols-4 gap-0 2xl:gap-2 mb-2">
              {/* Current Standing - Always show */}
              <div className="card p-6 border-x-0 22xl:border-x border-y 2xl:border border-primary-500/30 bg-gradient-to-br from-primary-500/5 to-transparent relative">
                {/* Header with icon */}
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-lg bg-primary-500/20 flex items-center justify-center">
                    {isLoadingStanding ? (
                      <div className="w-6 h-6 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
                    ) : currentStanding.rank && currentStanding.rank <= 3 ? (
                      <WorkspacePremiumIcon sx={{
                        color: currentStanding.rank === 1 ? '#facc15' : currentStanding.rank === 2 ? '#cbd5e1' : '#d97706',
                        fontSize: 24
                      }} />
                    ) : (
                      <EmojiEventsIcon sx={{ color: '#52525b', fontSize: 24 }} />
                    )}
                  </div>
                  <h3 className="text-sm font-semibold text-surface-300">Current Standing</h3>
                </div>

                {/* Content */}
                {isLoadingStanding ? (
                  <div className="h-8 w-24 bg-surface-700 rounded animate-pulse" />
                ) : currentStanding.rank && currentStanding.rank <= 3 ? (
                  <>
                    {/* Rank badge in top right corner */}
                    <div className="absolute top-4 right-4">
                      <span className={`text-xs font-bold px-2 py-1 rounded ${
                        currentStanding.rank === 1 ? 'bg-amber-400/20 text-amber-400' :
                        currentStanding.rank === 2 ? 'bg-slate-300/20 text-slate-300' :
                        'bg-orange-400/20 text-orange-400'
                      }`}>
                        {formatRank(currentStanding.rank)} Place
                      </span>
                    </div>

                    {/* Prize amount (large, centered where "2nd" was) */}
                    <div className="text-sm sm:text-3xl font-bold text-primary-400">
                      ${currentStanding.estimatedPrize.toFixed(2)}
                    </div>
                    <p className="text-xs text-surface-500 mt-1">Estimated Prize</p>
                  </>
                ) : (
                  <div>
                    <p className="text-surface-400 text-sm">No active prize</p>
                    <p className="text-surface-500 text-xs mt-1">Finish in top 3 to win prizes</p>
                  </div>
                )}
              </div>

              {/* Total Prizes */}
              <div className="card p-6 border-x-0 22xl:border-x border-y 2xl:border border-surface-800">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-lg bg-primary-500/10 flex items-center justify-center">
                    <EmojiEventsIcon sx={{ color: '#f97316', fontSize: 24 }} />
                  </div>
                  <h3 className="text-sm font-semibold text-surface-300">Total Prizes</h3>
                </div>
                <p className="text-sm sm:text-3xl font-bold text-white">{prizes.length}</p>
              </div>

              {/* Total Earned */}
              <div className="card p-6 border-x-0 22xl:border-x border-y 2xl:border border-surface-800">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-lg bg-accent-500/10 flex items-center justify-center">
                    <WorkspacePremiumIcon sx={{ color: '#facc15', fontSize: 24 }} />
                  </div>
                  <h3 className="text-sm font-semibold text-surface-300">Total Earned</h3>
                </div>
                <p className="text-sm sm:text-3xl font-bold text-white">
                  ${prizes.reduce((sum, p) => sum + p.amount, 0).toFixed(2)}
                </p>
              </div>

              {/* Total Claimed */}
              <div className="card p-6 border-x-0 22xl:border-x border-y 2xl:border border-surface-800">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-lg bg-win-500/10 flex items-center justify-center">
                    <CheckCircleIcon sx={{ color: '#10b981', fontSize: 24 }} />
                  </div>
                  <h3 className="text-sm font-semibold text-surface-300">Total Claimed</h3>
                </div>
                <p className="text-sm sm:text-3xl font-bold text-white">${totalClaimed.toFixed(2)}</p>
              </div>
            </div>
          )}

          {/* Loading state */}
          {isLoading && (
            <div className="animate-pulse space-y-2">
              {/* Stats Cards Skeleton */}
              <div className="grid grid-cols-1 2xl:grid-cols-4 gap-0 2xl:gap-2">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="card p-6 border-x-0 22xl:border-x border-y 2xl:border border-surface-800">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-10 h-10 bg-surface-700 rounded-lg" />
                      <div className="h-4 w-24 bg-surface-700 rounded" />
                    </div>
                    <div className="h-8 w-20 bg-surface-700 rounded" />
                  </div>
                ))}
              </div>

              {/* Table Skeleton */}
              <div className="card border-x-0 22xl:border-x border-y 2xl:border border-surface-800">
                <div className="p-6 px-2 2xl:px-6 border-b border-surface-800">
                  <div className="h-4 w-32 bg-surface-700" />
                </div>
                <div className="p-4 space-y-2">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="flex items-center justify-between py-2">
                      <div className="flex items-center gap-3">
                        <div className="w-6 h-6 bg-surface-700" />
                        <div className="h-4 w-24 bg-surface-700" />
                      </div>
                      <div className="h-4 w-20 bg-surface-700" />
                      <div className="h-4 w-16 bg-surface-700" />
                      <div className="h-6 w-16 bg-surface-700" />
                      <div className="h-8 w-20 bg-surface-700" />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Error state */}
          {error && (
            <div className="card p-8 border-x-0 22xl:border-x border-y 2xl:border border-surface-800 text-center">
              <p className="text-loss-400 mb-4">{error}</p>
              <button
                onClick={() => window.location.reload()}
                className="text-primary-400 hover:text-primary-300"
              >
                Try again
              </button>
            </div>
          )}

          {/* No prizes */}
          {!isLoading && !error && prizes.length === 0 && (
            <div className="card p-12 border-x-0 22xl:border-x border-y 2xl:border border-surface-800 text-center mx-0 2xl:mx-0">
              <EmojiEventsIcon sx={{ color: '#52525b', fontSize: 64, marginBottom: 16 }} />
              <h3 className="text-sm sm:text-lg font-semibold text-surface-300 mb-2">No prizes yet</h3>
              <p className="text-surface-500 mb-2">
                Win fights to earn weekly prizes! Top 3 traders each week share the prize pool.
              </p>
              <a href="/trade" className="btn-primary inline-block">
                Start Fighting
              </a>
            </div>
          )}

          {/* Prize table */}
          {!isLoading && !error && prizes.length > 0 && (
            <div className="card border-x-0 22xl:border-x border-y 2xl:border border-surface-800">
              <div className="p-6 px-2 2xl:px-6 border-b border-surface-800">
                <h3 className="text-sm font-semibold uppercase tracking-wide text-surface-300">
                  Prize History
                </h3>
              </div>
              <div className="overflow-x-auto">
                <table className="table-premium w-full">
                  <thead>
                    <tr className="bg-surface-850">
                      <th className="py-3 px-4 text-left text-xs font-medium text-surface-200">Rank</th>
                      <th className="py-3 px-4 text-left text-xs font-medium text-surface-200">Period</th>
                      <th className="py-3 px-4 text-right text-xs font-medium text-surface-200">Amount</th>
                      <th className="py-3 px-4 text-center text-xs font-medium text-surface-200">Status</th>
                      <th className="py-3 px-4 text-right text-xs font-medium text-surface-200">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {prizes.slice(0, prizesToShow).map((prize, index) => (
                      <PrizeRow
                        key={prize.id}
                        prize={prize}
                        onClaim={claimPrize}
                        isClaiming={claimingPrizeId === prize.id}
                        index={index}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
              {/* Load More Button */}
              {prizes.length > prizesToShow && (
                <div className="py-4 text-center border-t border-surface-800/50">
                  <button
                    onClick={() => setPrizesToShow(prev => prev + 10)}
                    className="text-sm text-primary-400 hover:text-primary-300 transition-colors"
                  >
                    Load More ({prizesToShow} of {prizes.length} prizes)
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Prize pool info */}
          <div className="mt-8 card p-6">
            <h2 className="font-display text-xs font-semibold uppercase tracking-wide text-surface-300 mb-4">
              How Weekly Prizes Work
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-sm">
              <div className="flex items-center gap-3">
                <WorkspacePremiumIcon sx={{ color: '#facc15', fontSize: 28 }} />
                <div>
                  <p className="text-white font-medium">1st Place</p>
                  <p className="text-surface-400 text-xs">5% of weekly fees</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <WorkspacePremiumIcon sx={{ color: '#cbd5e1', fontSize: 28 }} />
                <div>
                  <p className="text-white font-medium">2nd Place</p>
                  <p className="text-surface-400 text-xs">3% of weekly fees</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <WorkspacePremiumIcon sx={{ color: '#d97706', fontSize: 28 }} />
                <div>
                  <p className="text-white font-medium">3rd Place</p>
                  <p className="text-surface-400 text-xs">2% of weekly fees</p>
                </div>
              </div>
            </div>
            <p className="mt-4 text-xs text-surface-500">
              Rankings based on PnL. Finalized Sundays at midnight UTC.
            </p>
          </div>
        </div>
      </AppShell>
    </BetaGate>
  );
}
