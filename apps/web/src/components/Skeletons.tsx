'use client';

/**
 * Professional loading skeleton components
 * Provides smooth shimmer animations while content loads
 */

import { ReactNode } from 'react';

// Base skeleton with shimmer animation
function Skeleton({ className = '' }: { className?: string }) {
  return (
    <div
      className={`animate-pulse bg-gradient-to-r from-surface-800 via-surface-700 to-surface-800 bg-[length:200%_100%] animate-shimmer rounded ${className}`}
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
    <div className={`bg-surface-800 border border-surface-700 rounded-xl p-4 ${className}`}>
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
      <div className="flex justify-between items-center pt-2 border-t border-surface-700">
        <SkeletonText width="w-24" height="h-5" />
        <SkeletonButton width="w-20" height="h-8" />
      </div>
    </SkeletonCard>
  );
}

// Leaderboard Row Skeleton
export function LeaderboardRowSkeleton() {
  return (
    <tr className="border-b border-surface-700/50">
      <td className="py-4 px-4">
        <Skeleton className="w-10 h-10 rounded-lg" />
      </td>
      <td className="py-4 px-4">
        <div className="flex items-center gap-3">
          <SkeletonAvatar />
          <SkeletonText width="w-24" />
        </div>
      </td>
      <td className="py-4 px-4 text-center">
        <SkeletonText width="w-8" className="mx-auto" />
      </td>
      <td className="py-4 px-4 text-center">
        <SkeletonText width="w-16" className="mx-auto" />
      </td>
      <td className="py-4 px-4 text-center">
        <Skeleton className="w-20 h-2 rounded-full mx-auto" />
      </td>
      <td className="py-4 px-4 text-right">
        <SkeletonText width="w-16" className="ml-auto" />
      </td>
      <td className="py-4 px-4 text-right">
        <SkeletonText width="w-20" className="ml-auto" />
      </td>
    </tr>
  );
}

// Leaderboard Page Skeleton - Matches actual page layout
export function LeaderboardSkeleton() {
  return (
    <div className="space-y-6">
      {/* Title */}
      <div className="text-center mb-4">
        <SkeletonText width="w-48" height="h-10" className="mx-auto mb-2" />
        <SkeletonText width="w-64" height="h-4" className="mx-auto" />
      </div>

      {/* Prize Pool Badge */}
      <div className="flex justify-center">
        <Skeleton className="w-80 h-14 rounded-xl" />
      </div>

      {/* Range Toggle */}
      <div className="flex justify-center">
        <Skeleton className="w-56 h-12 rounded-xl" />
      </div>

      {/* Podium Cards (Desktop) */}
      <div className="hidden md:grid grid-cols-3 gap-3 max-w-3xl mx-auto">
        {[2, 1, 3].map((place) => (
          <SkeletonCard key={place} className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <Skeleton className="w-7 h-7 rounded-full" />
              <div className="space-y-1">
                <SkeletonText width="w-16" height="h-4" />
                <SkeletonText width="w-12" height="h-3" />
              </div>
            </div>
            <div className="mb-3">
              <SkeletonText width="w-10" height="h-3" className="mb-1" />
              <SkeletonText width="w-16" height="h-6" />
            </div>
            <div className="border-t border-surface-700/50 pt-3">
              <SkeletonText width="w-20" height="h-3" className="mb-2" />
              <div className="flex items-center gap-2">
                <SkeletonAvatar size="w-8 h-8" />
                <div className="space-y-1">
                  <SkeletonText width="w-20" height="h-4" />
                  <SkeletonText width="w-24" height="h-3" />
                </div>
              </div>
            </div>
          </SkeletonCard>
        ))}
      </div>

      {/* Table Skeleton */}
      <SkeletonCard className="overflow-hidden p-0">
        <table className="w-full">
          <thead>
            <tr className="border-b border-surface-700 bg-surface-850">
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
    <div className="space-y-8">
      {/* Profile Header */}
      <SkeletonCard className="flex flex-col md:flex-row items-center gap-6 p-8">
        <SkeletonAvatar size="w-24 h-24" />
        <div className="space-y-3 text-center md:text-left">
          <SkeletonText width="w-32" height="h-8" />
          <SkeletonText width="w-48" height="h-4" />
        </div>
        <div className="ml-auto hidden md:block">
          <SkeletonButton width="w-32" />
        </div>
      </SkeletonCard>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <SkeletonCard key={i} className="text-center py-6">
            <SkeletonText width="w-16" height="h-8" className="mx-auto mb-2" />
            <SkeletonText width="w-20" height="h-4" className="mx-auto" />
          </SkeletonCard>
        ))}
      </div>

      {/* Fight History */}
      <SkeletonCard className="p-0 overflow-hidden">
        <div className="p-4 border-b border-surface-700">
          <SkeletonText width="w-32" height="h-6" />
        </div>
        <div className="divide-y divide-surface-700/50">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="p-4 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <SkeletonAvatar />
                <div className="space-y-2">
                  <SkeletonText width="w-24" />
                  <SkeletonText width="w-16" height="h-3" />
                </div>
              </div>
              <SkeletonText width="w-16" height="h-6" />
            </div>
          ))}
        </div>
      </SkeletonCard>
    </div>
  );
}

// Arena/Lobby Skeleton - Tabs, filters, and content area
// Note: Header (title + stats) is rendered by the page wrapper
export function ArenaSkeleton() {
  return (
    <div className="space-y-6">
      {/* Tabs and Filters */}
      <div className="border-b border-surface-700 pb-3">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          {/* Tabs */}
          <div className="flex gap-1">
            {['Live', 'Pending', 'Finished', 'My Fights'].map((tab, i) => (
              <div key={tab} className={`px-4 py-2 text-sm rounded-lg ${i === 0 ? 'text-white bg-surface-800' : 'text-surface-500'}`}>
                {tab}
              </div>
            ))}
          </div>
          {/* Filters */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-surface-500">Filter:</span>
            <Skeleton className="w-28 h-8 rounded-lg" />
            <Skeleton className="w-24 h-8 rounded-lg" />
          </div>
        </div>
      </div>

      {/* Content - Loading state */}
      <div className="card text-center py-16">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 rounded-full border-4 border-surface-700 border-t-primary-500 animate-spin" />
          <p className="text-surface-500">Loading fights...</p>
        </div>
      </div>
    </div>
  );
}

// Position Row Skeleton (for Trade page)
export function PositionRowSkeleton() {
  return (
    <tr className="border-b border-surface-700/50">
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
    <div className="container mx-auto px-4 md:px-6 py-8">
      {title && (
        <div className="text-center mb-8">
          <h1 className="font-display text-3xl font-bold text-surface-600">{title}</h1>
        </div>
      )}
      <div className="flex justify-center py-20">
        <div className="flex flex-col items-center gap-4">
          <div className="relative">
            <div className="w-12 h-12 rounded-full border-4 border-surface-700 border-t-primary-500 animate-spin" />
          </div>
          <p className="text-surface-400 animate-pulse">Loading...</p>
        </div>
      </div>
    </div>
  );
}
