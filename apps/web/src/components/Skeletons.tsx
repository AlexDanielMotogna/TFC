'use client';

/**
 * Professional loading skeleton components
 * Provides smooth shimmer animations while content loads
 */

import { ReactNode } from 'react';
import { Spinner } from './Spinner';

// Base skeleton with shimmer animation
function Skeleton({ className = '' }: { className?: string }) {
  return (
    <div
      className={`animate-pulse bg-gradient-to-r from-surface-800 via-surface-700 to-surface-800 bg-[length:200%_100%] animate-shimmer ${className}`}
    />
  );
}

// Text skeleton
export function SkeletonText({ width = 'w-24', height = 'h-4', className = '' }: { width?: string; height?: string; className?: string }) {
  return <Skeleton className={`${width} ${height} ${className}`} />;
}

// Avatar skeleton
export function SkeletonAvatar({ size = 'w-10 h-10' }: { size?: string }) {
  return <Skeleton className={`${size} rounded-full`} />;
}

// Button skeleton
export function SkeletonButton({ width = 'w-24', height = 'h-10' }: { width?: string; height?: string }) {
  return <Skeleton className={`${width} ${height} rounded-lg`} />;
}

// Card skeleton
export function SkeletonCard({ children, className = '' }: { children?: ReactNode; className?: string }) {
  return (
    <div className={`bg-surface-800 border border-surface-800 p-4 ${className}`}>
      {children}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Page-Specific Skeletons
// ─────────────────────────────────────────────────────────────

// Fight Card Skeleton (for Arena/Lobby)
export function FightCardSkeleton() {
  return (
    <SkeletonCard className="space-y-4">
      {/* Header with status badge */}
      <div className="flex justify-between items-start">
        <Skeleton className="w-16 h-6 rounded-full" />
        <Skeleton className="w-20 h-5" />
      </div>

      {/* VS Section */}
      <div className="flex items-center justify-between py-4">
        {/* Player A */}
        <div className="flex items-center gap-3">
          <SkeletonAvatar size="w-12 h-12" />
          <div className="space-y-2">
            <SkeletonText width="w-20" />
            <SkeletonText width="w-16" height="h-3" />
          </div>
        </div>

        {/* VS */}
        <span className="text-surface-600 font-bold">VS</span>

        {/* Player B */}
        <div className="flex items-center gap-3">
          <div className="space-y-2 text-right">
            <SkeletonText width="w-20" />
            <SkeletonText width="w-16" height="h-3" />
          </div>
          <SkeletonAvatar size="w-12 h-12" />
        </div>
      </div>

      {/* Footer */}
      <div className="flex justify-between items-center pt-2 border-t border-surface-800">
        <SkeletonText width="w-24" height="h-5" />
        <SkeletonButton width="w-20" height="h-8" />
      </div>
    </SkeletonCard>
  );
}

// Leaderboard Row Skeleton
export function LeaderboardRowSkeleton() {
  return (
    <tr className="border-b border-surface-800/50">
      <td className="py-4 px-4">
        <Skeleton className="w-10 h-10 rounded-lg" />
      </td>
      <td className="py-4 px-4">
        <div className="flex items-center gap-3">
          <SkeletonAvatar />
          <SkeletonText width="w-24" />
        </div>
      </td>
      <td className="py-4 px-4">
        <SkeletonText width="w-8" />
      </td>
      <td className="py-4 px-4">
        <SkeletonText width="w-16" />
      </td>
      <td className="py-4 px-4">
        <Skeleton className="w-20 h-2 rounded-full" />
      </td>
      <td className="py-4 px-4">
        <SkeletonText width="w-16" />
      </td>
      <td className="py-4 px-4">
        <SkeletonText width="w-20" />
      </td>
    </tr>
  );
}

// Leaderboard Page Skeleton - Matches actual page layout
export function LeaderboardSkeleton() {
  return (
    <div className="space-y-2">
      {/* Stats Cards Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <SkeletonCard key={i} className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <Skeleton className="w-8 h-8 rounded-lg" />
              <SkeletonText width="w-20" height="h-3" />
            </div>
            <SkeletonText width="w-24" height="h-8" />
          </SkeletonCard>
        ))}
      </div>

      {/* Top 3 Podium Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-2 mb-2">
        {[1, 2, 3].map((place) => (
          <SkeletonCard key={place} className="p-6">
            <div className="flex items-center gap-3 mb-4">
              <Skeleton className="w-10 h-10 rounded-lg" />
              <div className="space-y-1 flex-1">
                <SkeletonText width="w-24" height="h-4" />
                <SkeletonText width="w-16" height="h-3" />
              </div>
            </div>
            <SkeletonText width="w-28" height="h-8" className="mb-2" />
            <div className="flex gap-3">
              <SkeletonText width="w-20" height="h-3" />
              <SkeletonText width="w-16" height="h-3" />
            </div>
          </SkeletonCard>
        ))}
      </div>

      {/* Table Skeleton */}
      <SkeletonCard className="overflow-hidden p-0">
        <table className="w-full">
          <thead>
            <tr className="border-b border-surface-800 bg-surface-850">
              {['Rank', 'Fighter', 'Fights', 'Record', 'Win Rate', 'Avg PnL', 'Total PnL'].map((h) => (
                <th key={h} className="py-3 px-4 text-left text-xs text-surface-400 font-medium">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: 5 }).map((_, i) => (
              <LeaderboardRowSkeleton key={i} />
            ))}
          </tbody>
        </table>
      </SkeletonCard>
    </div>
  );
}

// Profile Page Skeleton
export function ProfileSkeleton() {
  return (
    <div className="space-y-2">
      {/* Profile Header */}
      <SkeletonCard className="flex flex-col md:flex-row items-center md:items-start gap-2 p-6">
        {/* Avatar with rank badge */}
        <div className="relative">
          <SkeletonAvatar size="w-20 h-20" />
          <div className="absolute -bottom-1 -right-1 w-8 h-8 rounded-full bg-surface-700" />
        </div>

        {/* Info */}
        <div className="flex-1 space-y-2 text-center md:text-left">
          <div className="flex items-center justify-center md:justify-start gap-2">
            <SkeletonText width="w-32" height="h-6" />
            <Skeleton className="w-6 h-6" />
          </div>
          <SkeletonText width="w-40" height="h-3" />
          <div className="flex gap-2 justify-center md:justify-start">
            <Skeleton className="w-16 h-5" />
            <Skeleton className="w-14 h-5" />
          </div>
        </div>

        {/* Quick Stats */}
        <div className="text-center">
          <SkeletonText width="w-20" height="h-7" className="mx-auto mb-1" />
          <SkeletonText width="w-14" height="h-3" className="mx-auto" />
        </div>
      </SkeletonCard>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <SkeletonCard key={i} className="text-center p-4">
            <div className="flex items-center justify-center gap-2 mb-1">
              <Skeleton className="w-5 h-5" />
              <SkeletonText width="w-10" height="h-7" />
            </div>
            <SkeletonText width="w-16" height="h-3" className="mx-auto" />
          </SkeletonCard>
        ))}
      </div>

      {/* Performance Chart */}
      <SkeletonCard className="p-4">
        <SkeletonText width="w-32" height="h-4" className="mb-4" />

        {/* Chart Tabs */}
        <div className="flex gap-2 mb-4">
          <Skeleton className="w-28 h-8" />
          <Skeleton className="w-24 h-8" />
          <Skeleton className="w-28 h-8" />
        </div>

        {/* Chart Area */}
        <Skeleton className="w-full h-48" />
      </SkeletonCard>

      {/* Fight History */}
      <SkeletonCard className="p-0 overflow-hidden">
        <div className="p-4 border-b border-surface-800">
          <SkeletonText width="w-24" height="h-4" />
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-surface-800">
                {['Date', 'Duration', 'Stake', 'Opponent', 'Result', 'PnL'].map(
                  (h) => (
                    <th
                      key={h}
                      className="py-3 px-4 text-left text-xs text-surface-400"
                    >
                      {h}
                    </th>
                  )
                )}
              </tr>
            </thead>

            <tbody>
              {Array.from({ length: 5 }).map((_, i) => (
                <tr key={i} className="border-b border-surface-800/50">
                  <td className="py-4 px-4">
                    <SkeletonText width="w-24" />
                  </td>
                  <td className="py-4 px-4">
                    <SkeletonText width="w-12" />
                  </td>
                  <td className="py-4 px-4">
                    <SkeletonText width="w-16" />
                  </td>
                  <td className="py-4 px-4">
                    <SkeletonText width="w-20" />
                  </td>
                  <td className="py-4 px-4">
                    <Skeleton className="w-14 h-6" />
                  </td>
                  <td className="py-4 px-4">
                    <SkeletonText width="w-16" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SkeletonCard>
    </div>
  );
}


// Arena/Lobby Skeleton - Stats cards, tabs, and content area
// Note: Header (title + button) is rendered by the page wrapper
export function ArenaSkeleton() {
  return (
    <div className="space-y-2">
      {/* Stats Cards Row */}
      <div className="grid grid-cols-3 gap-2 mb-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <SkeletonCard key={i} className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <Skeleton className="w-8 h-8 rounded-lg" />
              <SkeletonText width="w-20" height="h-3" />
            </div>
            <SkeletonText width="w-16" height="h-8" />
          </SkeletonCard>
        ))}
      </div>

      {/* Tabs + Filters */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-4">
        <Skeleton className="w-72 h-10 rounded-xl" />
        <div className="flex items-center gap-2">
          <Skeleton className="w-28 h-8 rounded-lg" />
          <Skeleton className="w-24 h-8 rounded-lg" />
        </div>
      </div>

      {/* Content - Loading state */}
      <div className="text-center py-16 min-h-[200px] flex flex-col items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Spinner size="md" />
          <span className="text-sm text-surface-400">Loading fights...</span>
        </div>
      </div>
    </div>
  );
}

// Position Row Skeleton (for Trade page)
export function PositionRowSkeleton() {
  return (
    <tr className="border-b border-surface-800/50">
      <td className="py-3 px-4">
        <div className="flex items-center gap-2">
          <Skeleton className="w-6 h-6 rounded-full" />
          <SkeletonText width="w-16" />
        </div>
      </td>
      <td className="py-3 px-4">
        <SkeletonText width="w-12" />
      </td>
      <td className="py-3 px-4">
        <SkeletonText width="w-16" />
      </td>
      <td className="py-3 px-4">
        <SkeletonText width="w-16" />
      </td>
      <td className="py-3 px-4">
        <SkeletonText width="w-20" />
      </td>
      <td className="py-3 px-4">
        <SkeletonButton width="w-16" height="h-7" />
      </td>
    </tr>
  );
}

// Trade Panel Skeleton
export function TradePanelSkeleton() {
  return (
    <SkeletonCard className="space-y-4">
      {/* Market selector */}
      <Skeleton className="w-full h-12 rounded-lg" />

      {/* Price display */}
      <div className="text-center py-4">
        <SkeletonText width="w-32" height="h-10" className="mx-auto" />
      </div>

      {/* Order type tabs */}
      <div className="flex gap-2">
        <Skeleton className="flex-1 h-10 rounded-lg" />
        <Skeleton className="flex-1 h-10 rounded-lg" />
      </div>

      {/* Size input */}
      <div className="space-y-2">
        <SkeletonText width="w-16" height="h-4" />
        <Skeleton className="w-full h-12 rounded-lg" />
      </div>

      {/* Leverage slider */}
      <div className="space-y-2">
        <SkeletonText width="w-20" height="h-4" />
        <Skeleton className="w-full h-2 rounded-full" />
      </div>

      {/* Submit buttons */}
      <div className="grid grid-cols-2 gap-3 pt-4">
        <Skeleton className="h-12 rounded-lg" />
        <Skeleton className="h-12 rounded-lg" />
      </div>
    </SkeletonCard>
  );
}

// Generic page loading skeleton
export function PageLoadingSkeleton({ title }: { title?: string }) {
  return (
    <div className="container mx-auto px-2 md:px-6 py-8">
      {title && (
        <div className="text-center mb-8">
          <h1 className="font-display text-3xl font-bold text-surface-600">{title}</h1>
        </div>
      )}
      <div className="flex justify-center py-20">
        <div className="flex flex-col items-center gap-3">
          <Spinner size="lg" />
          <span className="text-sm text-surface-400">Loading...</span>
        </div>
      </div>
    </div>
  );
}
