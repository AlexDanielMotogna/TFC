'use client';

import { useEffect, useState, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/hooks';
import { api, type UserProfile, type Fight } from '@/lib/api';
import { AppShell } from '@/components/AppShell';
import { BetaGate } from '@/components/BetaGate';
import { ProfileSkeleton } from '@/components/Skeletons';
import { PerformanceChart } from '@/components/PerformanceChart';
import SportsKabaddiIcon from '@mui/icons-material/SportsKabaddi';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CancelIcon from '@mui/icons-material/Cancel';
import RemoveCircleOutlineIcon from '@mui/icons-material/RemoveCircleOutline';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';

export default function ProfilePage() {
  const params = useParams();
  const router = useRouter();
  const userId = params?.id as string;
  const { isAuthenticated, user: currentUser } = useAuth();

  // Track if we were viewing our own profile (to detect wallet changes)
  const wasOwnProfileRef = useRef<boolean>(false);
  const loadedProfileIdRef = useRef<string | null>(null);

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [fights, setFights] = useState<Fight[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [userRank, setUserRank] = useState<number | null>(null);
  const [visibleFights, setVisibleFights] = useState(20);

  // Redirect to new profile when wallet changes (if viewing own profile)
  useEffect(() => {
    // Skip during loading or if no profile loaded yet
    if (isLoading || !loadedProfileIdRef.current) return;

    // Check if we're viewing our own profile
    const isCurrentlyOwnProfile = currentUser?.id === loadedProfileIdRef.current;

    if (isCurrentlyOwnProfile) {
      // Mark that we're viewing our own profile
      wasOwnProfileRef.current = true;
    } else if (wasOwnProfileRef.current && currentUser?.id) {
      // We WERE viewing our own profile, but now currentUser is different
      // This means the user switched wallets - redirect to new profile
      wasOwnProfileRef.current = false;
      router.replace(`/profile/${currentUser.id}`);
    }
  }, [currentUser?.id, isLoading, router]);

  useEffect(() => {
    const fetchProfile = async () => {
      setIsLoading(true);
      setError(null);
      setVisibleFights(20); // Reset pagination
      // Reset refs when loading a new profile
      wasOwnProfileRef.current = false;
      loadedProfileIdRef.current = null;

      try {
        const [profileData, fightsData] = await Promise.all([
          api.getUserProfile(userId),
          api.getUserFights(userId),
        ]);
        setProfile(profileData);
        setFights(fightsData);
        // Track which profile we loaded
        loadedProfileIdRef.current = profileData.id;

        // Fetch user rank from leaderboard
        try {
          const leaderboard = await api.getLeaderboard('all_time');
          const userEntry = leaderboard.find((entry: any) => entry.userId === userId);
          if (userEntry) {
            setUserRank(userEntry.rank);
          }
        } catch (rankErr) {
          console.error('Failed to fetch user rank:', rankErr);
        }
      } catch (err) {
        console.error('Failed to fetch profile:', err);
        setError(err instanceof Error ? err.message : 'Failed to load profile');
      }
      setIsLoading(false);
    };

    fetchProfile();
  }, [userId]);

  // Set dynamic page title with user handle
  useEffect(() => {
    if (profile) {
      document.title = `${profile.handle} - Trading Fight Club`;
    } else {
      document.title = 'Profile - Trading Fight Club';
    }
  }, [profile]);

  if (isLoading) {
    return (
      <BetaGate>
        <AppShell>
          <div className="container mx-auto px-4 md:px-6 py-8">
            <ProfileSkeleton />
          </div>
        </AppShell>
      </BetaGate>
    );
  }

  if (error || !profile) {
    return (
      <BetaGate>
        <AppShell>
          <div className="flex items-center justify-center py-32">
            <div className="text-center">
              <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-surface-800 flex items-center justify-center">
                <span className="text-4xl opacity-50">?</span>
              </div>
              <p className="text-xl mb-4 text-surface-400">{error || 'Fighter not found'}</p>
              <Link href="/trade" className="btn-primary">
                Back to Arena
              </Link>
            </div>
          </div>
        </AppShell>
      </BetaGate>
    );
  }

  const { stats } = profile;
  const winRate =
    stats.totalFights > 0 ? ((stats.wins / stats.totalFights) * 100).toFixed(1) : '0';
  const isOwnProfile = currentUser?.id === profile.id;

  const handleCopyId = () => {
    navigator.clipboard.writeText(profile.id);
    // You could add a toast notification here
  };

  return (
    <BetaGate>
      <AppShell>
        <div className="container mx-auto px-4 md:px-6 py-8">
        {/* Profile Header */}
        <div className="card p-6 mb-6">
          <div className="flex flex-col md:flex-row items-center md:items-start gap-4">
            {/* Avatar */}
            <div className="relative">
              <div className="p-1 rounded-full bg-gradient-to-r from-primary-500 to-accent-500">
                <div className="avatar w-20 h-20 text-2xl bg-surface-850">
                  {profile.handle[0]?.toUpperCase() || '?'}
                </div>
              </div>
              {/* Rank Badge */}
              {userRank && (
                <div className="absolute -bottom-1 -right-1 w-8 h-8 rounded-full bg-primary-500 flex items-center justify-center font-bold text-xs border-2 border-surface-850">
                  #{userRank}
                </div>
              )}
            </div>

            {/* Info */}
            <div className="flex-1 text-center md:text-left">
              <div className="flex items-center justify-center md:justify-start gap-2 mb-2">
                <h1 className="font-display text-2xl font-bold tracking-wide">
                  {profile.handle}
                </h1>
                <button
                  onClick={handleCopyId}
                  className="p-2 hover:bg-surface-700 rounded-lg transition-colors"
                  title="Copy User ID"
                >
                  <ContentCopyIcon sx={{ fontSize: 18, color: '#71717a' }} />
                </button>
              </div>
              <p className="text-surface-400 mb-4">
                User since{' '}
                {new Date(profile.createdAt).toLocaleDateString('en-US', {
                  month: 'long',
                  year: 'numeric',
                })}
              </p>
              <div className="flex flex-wrap justify-center md:justify-start gap-2">
                {Number(winRate) >= 60 && (
                  <span className="bg-win-500/20 text-win-400 px-3 py-1 rounded-full text-xs">
                    Top Trader
                  </span>
                )}
                <span className="bg-surface-700 px-3 py-1 rounded-full text-xs text-surface-400">
                  {stats.totalFights} Fights
                </span>
                {isOwnProfile && (
                  <span className="bg-primary-500/20 text-primary-400 px-3 py-1 rounded-full text-xs">
                    Your Profile
                  </span>
                )}
              </div>
            </div>

            {/* Quick Stats */}
            <div className="flex gap-6 text-center">
              <div>
                <p
                  className={`text-2xl font-bold ${
                    stats.totalPnlUsdc >= 0 ? 'pnl-positive' : 'pnl-negative'
                  }`}
                >
                  {stats.totalPnlUsdc >= 0 ? '+' : '-'}${Math.abs(stats.totalPnlUsdc).toLocaleString()}
                </p>
                <p className="text-xs text-surface-400">Total PnL</p>
              </div>
            </div>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
          <div className="card p-4 text-center">
            <div className="flex items-center justify-center gap-2 mb-1">
              <SportsKabaddiIcon sx={{ fontSize: 20, color: '#ffffff' }} />
              <p className="text-2xl font-bold text-white">{stats.totalFights}</p>
            </div>
            <p className="text-xs text-surface-400">Total Fights</p>
          </div>
          <div className="card p-4 text-center">
            <div className="flex items-center justify-center gap-2 mb-1">
              <CheckCircleIcon sx={{ fontSize: 20, color: '#26A69A' }} />
              <p className="text-2xl font-bold text-win-400">{stats.wins}</p>
            </div>
            <p className="text-xs text-surface-400">Wins</p>
          </div>
          <div className="card p-4 text-center">
            <div className="flex items-center justify-center gap-2 mb-1">
              <CancelIcon sx={{ fontSize: 20, color: '#EF5350' }} />
              <p className="text-2xl font-bold text-loss-400">{stats.losses}</p>
            </div>
            <p className="text-xs text-surface-400">Losses</p>
          </div>
          <div className="card p-4 text-center">
            <div className="flex items-center justify-center gap-2 mb-1">
              <RemoveCircleOutlineIcon sx={{ fontSize: 20, color: '#71717a' }} />
              <p className="text-2xl font-bold text-surface-400">{stats.draws ?? (stats.totalFights - stats.wins - stats.losses)}</p>
            </div>
            <p className="text-xs text-surface-400">Draws</p>
          </div>
          <div className="card p-4 text-center">
            <div className="flex items-center justify-center gap-2 mb-1">
              <TrendingUpIcon sx={{ fontSize: 20, color: '#f97316' }} />
              <p className="text-2xl font-bold text-primary-400">{winRate}%</p>
            </div>
            <p className="text-xs text-surface-400">Win Rate</p>
          </div>
        </div>

        {/* Performance Chart */}
        <div className="card p-4 mb-6">
          <h2 className="font-display text-sm font-semibold uppercase tracking-wide mb-4 text-surface-300">
            Performance History
          </h2>
          <PerformanceChart fights={fights} userId={userId} />
        </div>

        {/* Fight History */}
        <div className="card overflow-hidden">
          <div className="p-4 border-b border-surface-700">
            <h2 className="font-display text-sm font-semibold uppercase tracking-wide text-surface-300">
              Fight History
            </h2>
          </div>
          {fights.length === 0 ? (
            <div className="p-12 text-center">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-surface-800 flex items-center justify-center">
                <span className="text-3xl opacity-50">⚔</span>
              </div>
              <p className="text-surface-400 mb-4">No fight history yet</p>
              <Link href="/trade" className="text-primary-400 hover:text-primary-300">
                Enter the arena →
              </Link>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs text-surface-200 capitalize tracking-wider border-b border-surface-700">
                    <th className="text-left py-3 px-4">Date</th>
                    <th className="text-center py-3 px-4">Duration</th>
                    <th className="text-center py-3 px-4">Stake</th>
                    <th className="text-center py-3 px-4">Opponent</th>
                    <th className="text-center py-3 px-4">Result</th>
                    <th className="text-right py-3 px-4">PnL</th>
                  </tr>
                </thead>
                <tbody>
                  {fights.slice(0, visibleFights).map((fight) => {
                    const isWin = fight.winnerId === profile.id;
                    const isDraw = fight.isDraw;
                    const myParticipant = fight.participants?.find(
                      (p) => p.userId === profile.id
                    );
                    const opponent = fight.participants?.find(
                      (p) => p.userId !== profile.id
                    );

                    // Get actual PnL from participant's finalScoreUsdc
                    const pnl = myParticipant?.finalScoreUsdc
                      ? parseFloat(String(myParticipant.finalScoreUsdc))
                      : 0;
                    const pnlIsPositive = pnl >= 0;

                    return (
                      <tr key={fight.id} className="border-b border-surface-700/50 hover:bg-surface-800/30">
                        <td className="py-4 px-4 text-surface-400">
                          {fight.status === 'LIVE'
                            ? 'In Progress'
                            : new Date(fight.endedAt || fight.updatedAt).toLocaleString('en-US', {
                                month: 'short',
                                day: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                        </td>
                        <td className="py-4 px-4 text-center text-white">{fight.durationMinutes}m</td>
                        <td className="py-4 px-4 text-center text-primary-400">
                          ${fight.stakeUsdc}
                        </td>
                        <td className="py-4 px-4 text-center">
                          {opponent ? (
                            <Link
                              href={`/profile/${opponent.userId}`}
                              className="hover:text-primary-400 transition-colors"
                            >
                              {opponent.user?.handle || 'Unknown'}
                            </Link>
                          ) : (
                            <span className="text-surface-500">-</span>
                          )}
                        </td>
                        <td className="py-4 px-4 text-center">
                          {fight.status === 'FINISHED' ? (
                            isDraw ? (
                              <span className="px-2 py-1 rounded text-xs bg-surface-700 text-surface-400">DRAW</span>
                            ) : isWin ? (
                              <span className="px-2 py-1 rounded text-xs bg-win-500/20 text-win-400">WIN</span>
                            ) : (
                              <span className="px-2 py-1 rounded text-xs bg-loss-500/20 text-loss-400">LOSS</span>
                            )
                          ) : (
                            <span className="px-2 py-1 rounded text-xs bg-primary-500/20 text-primary-400">{fight.status}</span>
                          )}
                        </td>
                        <td className="py-4 px-4 text-right">
                          {fight.status === 'FINISHED' && (
                            <span
                              className={`${
                                pnlIsPositive ? 'text-emerald-400' : 'text-red-400'
                              }`}
                            >
                              {pnlIsPositive ? '+' : '-'}${Math.abs(pnl).toFixed(Math.abs(pnl) < 1 ? 4 : 2)}
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          {/* Load More Button */}
          {fights.length > visibleFights && (
            <div className="p-4 border-t border-surface-700 text-center">
              <button
                onClick={() => setVisibleFights((prev) => prev + 20)}
                className="text-sm text-primary-400 hover:text-primary-300 transition-colors"
              >
                Load More ({visibleFights} of {fights.length} fights)
              </button>
            </div>
          )}
        </div>

        {/* Actions for own profile */}
        {isOwnProfile && (
          <div className="mt-8 flex justify-center gap-4">
            <Link href="/trade" className="btn-primary">
              Find a Fight
            </Link>
            <Link href="/trade" className="btn-secondary">
              Practice Trading
            </Link>
          </div>
        )}
      </div>
      </AppShell>
    </BetaGate>
  );
}
