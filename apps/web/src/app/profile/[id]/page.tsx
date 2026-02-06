'use client';

import { useEffect, useState, useRef, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/hooks';
import { useUserTrades } from '@/hooks/useUserTrades';
import { api, type UserProfile, type Fight } from '@/lib/api';
import { AppShell } from '@/components/AppShell';
import { BetaGate } from '@/components/BetaGate';
import { ProfileSkeleton } from '@/components/Skeletons';
import { PerformanceChart } from '@/components/PerformanceChart';
import TradesHistoryTable from '@/components/TradesHistoryTable';
import { toastOnly } from '@/lib/notify';
import { Sparkline, generateMockTrendData } from '@/components/Sparkline';
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
  const [mode, setMode] = useState<'fights' | 'trades'>('fights');
  const [fightSortField, setFightSortField] = useState<'date' | 'duration' | 'stake' | 'result' | 'pnl'>('date');
  const [fightSortDirection, setFightSortDirection] = useState<'asc' | 'desc'>('desc');

  // Fetch user trades
  const { trades, loading: tradesLoading } = useUserTrades(userId);

  // Redirect to /profile when user disconnects
  useEffect(() => {
    if (!isAuthenticated) {
      router.replace('/profile');
    }
  }, [isAuthenticated, router]);

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

  // Calculate total PnL from trades
  const tradesPnl = trades.reduce((sum, trade) => sum + parseFloat(trade.pnl || '0'), 0);

  // Calculate stats-based values (safe to call hooks here)
  const stats = profile?.stats;
  const winRate = stats && stats.totalFights > 0
    ? ((stats.wins / stats.totalFights) * 100).toFixed(1)
    : '0';
  const isOwnProfile = currentUser?.id === profile?.id;

  // Handle fight sorting
  const handleFightSort = (field: 'date' | 'duration' | 'stake' | 'result' | 'pnl') => {
    if (fightSortField === field) {
      setFightSortDirection(fightSortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setFightSortField(field);
      setFightSortDirection('desc');
    }
  };

  // Sort fights
  const sortedFights = useMemo(() => {
    return [...fights].sort((a, b) => {
      let aValue: any;
      let bValue: any;

      switch (fightSortField) {
        case 'date':
          aValue = new Date(a.endedAt || a.updatedAt).getTime();
          bValue = new Date(b.endedAt || b.updatedAt).getTime();
          break;
        case 'duration':
          aValue = a.durationMinutes || 0;
          bValue = b.durationMinutes || 0;
          break;
        case 'stake':
          aValue = a.stakeUsdc || 0;
          bValue = b.stakeUsdc || 0;
          break;
        case 'result':
          // Sort by win/draw/loss
          aValue = a.winnerId === userId ? 2 : (a.isDraw ? 1 : 0);
          bValue = b.winnerId === userId ? 2 : (b.isDraw ? 1 : 0);
          break;
        case 'pnl':
          const myParticipantA = a.participants?.find((p) => p.userId === userId);
          const myParticipantB = b.participants?.find((p) => p.userId === userId);
          aValue = myParticipantA?.finalScoreUsdc ? parseFloat(String(myParticipantA.finalScoreUsdc)) : 0;
          bValue = myParticipantB?.finalScoreUsdc ? parseFloat(String(myParticipantB.finalScoreUsdc)) : 0;
          break;
        default:
          return 0;
      }

      if (aValue < bValue) return fightSortDirection === 'asc' ? -1 : 1;
      if (aValue > bValue) return fightSortDirection === 'asc' ? 1 : -1;
      return 0;
    });
  }, [fights, fightSortField, fightSortDirection, userId]);

  // Memoize sparkline data to prevent regeneration on re-renders
  const totalFightsData = useMemo(() =>
    stats ? generateMockTrendData(stats.totalFights, 20, 0.2) : [],
    [stats?.totalFights]
  );
  const winsData = useMemo(() =>
    stats ? generateMockTrendData(stats.wins, 20, 0.25) : [],
    [stats?.wins]
  );
  const lossesData = useMemo(() =>
    stats ? generateMockTrendData(stats.losses, 20, 0.25) : [],
    [stats?.losses]
  );
  const drawsValue = stats ? (stats.draws ?? (stats.totalFights - stats.wins - stats.losses)) : 0;
  const drawsData = useMemo(() =>
    stats ? generateMockTrendData(drawsValue, 20, 0.3) : [],
    [drawsValue]
  );
  const winRateData = useMemo(() =>
    generateMockTrendData(parseFloat(winRate), 20, 0.15),
    [winRate]
  );

  if (isLoading) {
    return (
      <BetaGate>
        <AppShell>
          <div className="container mx-auto px-2 md:px-6 py-8">
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
              <div className="w-20 h-20 mx-auto mb-2 rounded-full bg-surface-800 flex items-center justify-center">
                <span className="text-4xl opacity-50">?</span>
              </div>
              <p className="text-xl mb-4 text-surface-400">{error || 'Fighter not found'}</p>
              <Link href="/lobby" className="btn-primary">
                Back to Arena
              </Link>
            </div>
          </div>
        </AppShell>
      </BetaGate>
    );
  }

  // TypeScript now knows profile and stats are defined
  const profileStats = profile.stats;

  const handleCopyId = () => {
    navigator.clipboard.writeText(profile.id);
    toastOnly('User ID copied to clipboard', 'success');
  };

  return (
    <BetaGate>
      <AppShell>
        <div className="container mx-auto px-2 md:px-6 py-8">
        {/* Profile Header */}
        <div className="card p-6 mb-2">
          <div className="flex flex-col md:flex-row items-center md:items-start gap-2">
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
              </div>
            </div>

            {/* Quick Stats */}
            <div className="flex gap-6 text-center">
              <div>
                <p
                  className={`text-2xl font-bold ${
                    (mode === 'fights' ? profileStats.totalPnlUsdc : tradesPnl) >= 0 ? 'pnl-positive' : 'pnl-negative'
                  }`}
                >
                  {(mode === 'fights' ? profileStats.totalPnlUsdc : tradesPnl) >= 0 ? '+' : '-'}${Math.abs(mode === 'fights' ? profileStats.totalPnlUsdc : tradesPnl).toLocaleString()}
                </p>
                <p className="text-xs text-surface-400">Total PnL</p>
              </div>
            </div>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-2 mb-2">
          {/* Total Fights */}
          <div className="card p-4 relative overflow-hidden min-h-[100px]">
            <div className="relative z-10 mb-2">
              <p className="text-2xl sm:text-3xl font-bold text-white">{profileStats.totalFights}</p>
              <p className="text-xs text-surface-400 mt-1">Total Fights</p>
            </div>
            <div className="absolute inset-0 flex items-end opacity-60">
              <div className="w-full h-[60px]">
                <Sparkline
                  data={totalFightsData}
                  color="#6366f1"
                  width={200}
                  height={60}
                />
              </div>
            </div>
          </div>

          {/* Wins */}
          <div className="card p-4 relative overflow-hidden min-h-[100px]">
            <div className="relative z-10 mb-2">
              <p className="text-2xl sm:text-3xl font-bold text-white">{profileStats.wins}</p>
              <p className="text-xs text-surface-400 mt-1">Wins</p>
            </div>
            <div className="absolute inset-0 flex items-end opacity-60">
              <div className="w-full h-[60px]">
                <Sparkline
                  data={winsData}
                  color="#26A69A"
                  width={200}
                  height={60}
                />
              </div>
            </div>
          </div>

          {/* Losses */}
          <div className="card p-4 relative overflow-hidden min-h-[100px]">
            <div className="relative z-10 mb-2">
              <p className="text-2xl sm:text-3xl font-bold text-white">{profileStats.losses}</p>
              <p className="text-xs text-surface-400 mt-1">Losses</p>
            </div>
            <div className="absolute inset-0 flex items-end opacity-60">
              <div className="w-full h-[60px]">
                <Sparkline
                  data={lossesData}
                  color="#EF5350"
                  width={200}
                  height={60}
                />
              </div>
            </div>
          </div>

          {/* Draws */}
          <div className="card p-4 relative overflow-hidden min-h-[100px]">
            <div className="relative z-10 mb-2">
              <p className="text-2xl sm:text-3xl font-bold text-white">{drawsValue}</p>
              <p className="text-xs text-surface-400 mt-1">Draws</p>
            </div>
            <div className="absolute inset-0 flex items-end opacity-60">
              <div className="w-full h-[60px]">
                <Sparkline
                  data={drawsData}
                  color="#71717a"
                  width={200}
                  height={60}
                />
              </div>
            </div>
          </div>

          {/* Win Rate */}
          <div className="card p-4 relative overflow-hidden min-h-[100px]">
            <div className="relative z-10 mb-2">
              <p className="text-2xl sm:text-3xl font-bold text-white">{winRate}%</p>
              <p className="text-xs text-surface-400 mt-1">Win Rate</p>
            </div>
            <div className="absolute inset-0 flex items-end opacity-60">
              <div className="w-full h-[60px]">
                <Sparkline
                  data={winRateData}
                  color="#f97316"
                  width={200}
                  height={60}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Mode Toggle - Professional & Minimalist */}
        <div className="flex gap-1 mb-4 bg-surface-800/50 p-1 rounded-lg w-fit">
          <button
            onClick={() => setMode('fights')}
            className={`px-3 py-1.5 text-sm rounded-md transition-all ${
              mode === 'fights'
                ? 'bg-surface-700 text-white font-medium'
                : 'text-surface-400 hover:text-surface-300'
            }`}
          >
            Fights
          </button>
          <button
            onClick={() => setMode('trades')}
            className={`px-3 py-1.5 text-sm rounded-md transition-all ${
              mode === 'trades'
                ? 'bg-surface-700 text-white font-medium'
                : 'text-surface-400 hover:text-surface-300'
            }`}
          >
            Trades
          </button>
        </div>

        {/* Performance Chart */}
        <div className="card overflow-hidden mb-2">
          <div className="p-4 sm:p-6 border-b border-surface-800">
            <h2 className="text-lg sm:text-xl font-bold">Performance History</h2>
          </div>
          <div className="p-4">
            {mode === 'fights' ? (
              <PerformanceChart fights={fights} userId={userId} mode="fights" />
            ) : (
              <PerformanceChart trades={trades} userId={userId} mode="trades" />
            )}
          </div>
        </div>

        {/* History Table - Conditional */}
        {mode === 'fights' ? (
          /* Fight History */
          <div className="card overflow-hidden">
            <div className="p-4 sm:p-6 border-b border-surface-800">
              <h2 className="text-lg sm:text-xl font-bold">Fight History</h2>
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
            <div className="p-4 sm:p-6">
              <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs text-surface-400 capitalize tracking-wider bg-surface-850">
                    <th
                      className="text-left py-3 px-2 sm:px-4 font-medium cursor-pointer hover:text-surface-300 transition-colors whitespace-nowrap"
                      onClick={() => handleFightSort('date')}
                    >
                      <div className="flex items-center gap-1">
                        Date
                        {fightSortField === 'date' && (
                          <span className="text-primary-400">{fightSortDirection === 'asc' ? '↑' : '↓'}</span>
                        )}
                      </div>
                    </th>
                    <th
                      className="text-center py-3 px-2 sm:px-4 font-medium cursor-pointer hover:text-surface-300 transition-colors whitespace-nowrap"
                      onClick={() => handleFightSort('duration')}
                    >
                      <div className="flex items-center justify-center gap-1">
                        Duration
                        {fightSortField === 'duration' && (
                          <span className="text-primary-400">{fightSortDirection === 'asc' ? '↑' : '↓'}</span>
                        )}
                      </div>
                    </th>
                    <th
                      className="text-center py-3 px-2 sm:px-4 font-medium cursor-pointer hover:text-surface-300 transition-colors whitespace-nowrap"
                      onClick={() => handleFightSort('stake')}
                    >
                      <div className="flex items-center justify-center gap-1">
                        Stake
                        {fightSortField === 'stake' && (
                          <span className="text-primary-400">{fightSortDirection === 'asc' ? '↑' : '↓'}</span>
                        )}
                      </div>
                    </th>
                    <th className="text-center py-3 px-2 sm:px-4 font-medium whitespace-nowrap">Opponent</th>
                    <th
                      className="text-center py-3 px-2 sm:px-4 font-medium cursor-pointer hover:text-surface-300 transition-colors whitespace-nowrap"
                      onClick={() => handleFightSort('result')}
                    >
                      <div className="flex items-center justify-center gap-1">
                        Result
                        {fightSortField === 'result' && (
                          <span className="text-primary-400">{fightSortDirection === 'asc' ? '↑' : '↓'}</span>
                        )}
                      </div>
                    </th>
                    <th
                      className="text-right py-3 px-2 sm:px-4 font-medium cursor-pointer hover:text-surface-300 transition-colors whitespace-nowrap"
                      onClick={() => handleFightSort('pnl')}
                    >
                      <div className="flex items-center justify-end gap-1">
                        PnL
                        {fightSortField === 'pnl' && (
                          <span className="text-primary-400">{fightSortDirection === 'asc' ? '↑' : '↓'}</span>
                        )}
                      </div>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {sortedFights.slice(0, visibleFights).map((fight, index) => {
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
                      <tr key={fight.id} className={`transition-colors ${index % 2 === 0 ? 'bg-surface-800/30' : ''} hover:bg-surface-800/50`}>
                        <td className="py-3 px-2 sm:px-4 text-surface-400 whitespace-nowrap">
                          {fight.status === 'LIVE'
                            ? 'In Progress'
                            : new Date(fight.endedAt || fight.updatedAt).toLocaleString('en-US', {
                                month: 'short',
                                day: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit',
                                hour12: false,
                              })}
                        </td>
                        <td className="py-3 px-2 sm:px-4 text-center text-white">{fight.durationMinutes}m</td>
                        <td className="py-3 px-2 sm:px-4 text-center text-primary-400">
                          ${fight.stakeUsdc}
                        </td>
                        <td className="py-3 px-2 sm:px-4 text-center">
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
                        <td className="py-3 px-2 sm:px-4 text-center">
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
                        <td className="py-3 px-2 sm:px-4 text-right">
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

              {/* Load More Button */}
              {sortedFights.length > visibleFights && (
                <div className="mt-4 text-center">
                  <button
                    onClick={() => setVisibleFights((prev) => prev + 20)}
                    className="text-sm text-primary-400 hover:text-primary-300 transition-colors"
                  >
                    Load More ({visibleFights} of {sortedFights.length} fights)
                  </button>
                </div>
              )}
            </div>
          )}
          </div>
        ) : (
          /* Trades History */
          <TradesHistoryTable trades={trades} userId={userId} />
        )}

        {/* Actions for own profile */}
        {isOwnProfile && (
          <div className="mt-8 flex justify-center gap-2">
            <Link href="/lobby" className="btn-primary">
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
