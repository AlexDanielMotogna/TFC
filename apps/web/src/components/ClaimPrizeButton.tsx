'use client';

import { useState } from 'react';
import { type UserPrize } from '@/hooks/useMyPrizes';
import WorkspacePremiumIcon from '@mui/icons-material/WorkspacePremium';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import CircularProgress from '@mui/material/CircularProgress';

interface ClaimPrizeButtonProps {
  prize: UserPrize;
  onClaim: (prizeId: string) => Promise<{
    success: boolean;
    txSignature?: string;
    explorerUrl?: string;
    error?: string;
  }>;
  isClaiming: boolean;
}

// Format rank with ordinal suffix
const formatRank = (rank: number): string => {
  switch (rank) {
    case 1:
      return '1st';
    case 2:
      return '2nd';
    case 3:
      return '3rd';
    default:
      return `${rank}th`;
  }
};

// Medal colors
const DEFAULT_RANK_COLORS = {
  medal: '#d97706',
  bg: 'bg-orange-600/10',
  border: 'border-orange-600/30',
  text: 'text-orange-400',
};

const RANK_COLORS: Record<number, typeof DEFAULT_RANK_COLORS> = {
  1: {
    medal: '#facc15',
    bg: 'bg-amber-500/10',
    border: 'border-amber-500/30',
    text: 'text-amber-400',
  },
  2: {
    medal: '#cbd5e1',
    bg: 'bg-slate-400/10',
    border: 'border-slate-400/30',
    text: 'text-slate-300',
  },
  3: DEFAULT_RANK_COLORS,
};

export function ClaimPrizeButton({ prize, onClaim, isClaiming }: ClaimPrizeButtonProps) {
  const [claimResult, setClaimResult] = useState<{
    success: boolean;
    txSignature?: string;
    explorerUrl?: string;
    error?: string;
  } | null>(null);

  const colors = RANK_COLORS[prize.rank] ?? DEFAULT_RANK_COLORS;

  const handleClaim = async () => {
    setClaimResult(null);
    const result = await onClaim(prize.id);
    setClaimResult(result);
  };

  // Format week dates
  const weekStart = new Date(prize.weekStartDate);
  const weekEnd = new Date(prize.weekEndDate);
  const weekLabel = `${weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${weekEnd.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;

  // Already claimed
  if (prize.status === 'DISTRIBUTED') {
    return (
      <div className={`p-4 rounded-xl ${colors.bg} border ${colors.border}`}>
        <div className="flex items-center gap-3 mb-3">
          <WorkspacePremiumIcon sx={{ color: colors.medal, fontSize: 28 }} />
          <div className="flex-1">
            <p className={`font-bold ${colors.text}`}>{formatRank(prize.rank)} Place</p>
            <p className="text-xs text-surface-500">{weekLabel}</p>
          </div>
          <div className="text-right">
            <p className="text-xl font-bold text-white">${prize.amount.toFixed(2)}</p>
          </div>
        </div>

        <div className="flex items-center justify-between text-sm">
          <div className="flex items-center gap-2 text-win-400">
            <CheckCircleIcon sx={{ fontSize: 16 }} />
            <span>Claimed</span>
          </div>
          {prize.txSignature && (
            <a
              href={`https://solscan.io/tx/${prize.txSignature}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-primary-400 hover:text-primary-300 transition-colors"
            >
              <span className="font-mono">{prize.txSignature.slice(0, 8)}...</span>
              <OpenInNewIcon sx={{ fontSize: 14 }} />
            </a>
          )}
        </div>
      </div>
    );
  }

  // Pending (week not ended yet)
  if (prize.status === 'PENDING') {
    return (
      <div className={`p-4 rounded-xl ${colors.bg} border ${colors.border} opacity-75`}>
        <div className="flex items-center gap-3 mb-3">
          <WorkspacePremiumIcon sx={{ color: colors.medal, fontSize: 28 }} />
          <div className="flex-1">
            <p className={`font-bold ${colors.text}`}>{formatRank(prize.rank)} Place</p>
            <p className="text-xs text-surface-500">{weekLabel}</p>
          </div>
          <div className="text-right">
            <p className="text-xl font-bold text-white">${prize.amount.toFixed(2)}</p>
          </div>
        </div>

        <div className="text-sm text-surface-400 text-center py-2">
          Available to claim after week ends
        </div>
      </div>
    );
  }

  // Earned - can claim
  return (
    <div className={`p-4 rounded-xl ${colors.bg} border ${colors.border}`}>
      <div className="flex items-center gap-3 mb-4">
        <WorkspacePremiumIcon sx={{ color: colors.medal, fontSize: 28 }} />
        <div className="flex-1">
          <p className={`font-bold ${colors.text}`}>{formatRank(prize.rank)} Place</p>
          <p className="text-xs text-surface-500">{weekLabel}</p>
        </div>
        <div className="text-right">
          <p className="text-xl font-bold text-white">${prize.amount.toFixed(2)}</p>
          <p className="text-xs text-surface-500">USDC</p>
        </div>
      </div>

      {/* Claim result message */}
      {claimResult && !claimResult.success && (
        <div className="mb-3 p-2 bg-loss-500/10 border border-loss-500/30 rounded-lg text-sm text-loss-400">
          {claimResult.error}
        </div>
      )}

      {claimResult?.success ? (
        <div className="space-y-2">
          <div className="flex items-center justify-center gap-2 text-win-400 py-2">
            <CheckCircleIcon sx={{ fontSize: 20 }} />
            <span className="font-semibold">Claimed Successfully!</span>
          </div>
          {claimResult.explorerUrl && (
            <a
              href={claimResult.explorerUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 text-sm text-primary-400 hover:text-primary-300 transition-colors"
            >
              <span>View Transaction</span>
              <OpenInNewIcon sx={{ fontSize: 14 }} />
            </a>
          )}
        </div>
      ) : (
        <button
          onClick={handleClaim}
          disabled={isClaiming}
          className="w-full py-3 px-4 bg-gradient-to-r from-primary-500 to-primary-600 hover:from-primary-600 hover:to-primary-700 disabled:from-surface-600 disabled:to-surface-700 disabled:cursor-not-allowed text-white font-semibold rounded-lg transition-all duration-200 flex items-center justify-center gap-2"
        >
          {isClaiming ? (
            <>
              <CircularProgress size={18} color="inherit" />
              <span>Claiming...</span>
            </>
          ) : (
            <>
              <span>Claim ${prize.amount.toFixed(2)} USDC</span>
            </>
          )}
        </button>
      )}
    </div>
  );
}

export default ClaimPrizeButton;
