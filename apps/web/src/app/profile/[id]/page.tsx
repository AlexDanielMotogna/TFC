'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/hooks';
import { api, type UserProfile, type Fight } from '@/lib/api';
import { AppShell } from '@/components/AppShell';
import { ProfileSkeleton } from '@/components/Skeletons';

export default function ProfilePage() {
  const params = useParams();
  const userId = params?.id as string;
  const { isAuthenticated, user: currentUser } = useAuth();

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [fights, setFights] = useState<Fight[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchProfile = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const [profileData, fightsData] = await Promise.all([
          api.getUserProfile(userId),
          api.getUserFights(userId),
        ]);
        setProfile(profileData);
        setFights(fightsData);
      } catch (err) {
        console.error('Failed to fetch profile:', err);
        setError(err instanceof Error ? err.message : 'Failed to load profile');
      }
      setIsLoading(false);
    };

    fetchProfile();
  }, [userId]);

  if (isLoading) {
    return (
      <AppShell>
        <div className="container mx-auto px-4 md:px-6 py-8">
          <ProfileSkeleton />
        </div>
      </AppShell>
    );
  }

  if (error || !profile) {
    return (
      <AppShell>
        <div className="flex items-center justify-center py-32">
          <div className="text-center">
            <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-surface-800 flex items-center justify-center">
              <span className="text-4xl opacity-50">?</span>
            </div>
            <p className="text-xl mb-4 text-surface-400">{error || 'Fighter not found'}</p>
            <Link href="/lobby" className="btn-primary">
              Back to Arena
            </Link>
          </div>
        </div>
      </AppShell>
    );
  }

  const { stats } = profile;
  const winRate =
    stats.totalFights > 0 ? ((stats.wins / stats.totalFights) * 100).toFixed(1) : '0';
  const isOwnProfile = currentUser?.id === profile.id;

  return (
    <AppShell>
      <div className="container mx-auto px-4 md:px-6 py-8">
        {/* Profile Header */}
        <div className="card p-8 mb-8">
          <div className="flex flex-col md:flex-row items-center md:items-start gap-6">
            {/* Avatar */}
            <div className="relative">
              <div className="p-1.5 rounded-full bg-gradient-to-r from-primary-500 to-accent-500">
                <div className="avatar w-28 h-28 text-4xl bg-surface-850">
                  {profile.handle[0]?.toUpperCase() || '?'}
                </div>
              </div>
              {/* Rank Badge */}
              <div className="absolute -bottom-2 -right-2 w-10 h-10 rounded-full bg-primary-500 flex items-center justify-center font-bold text-sm border-4 border-surface-850">
                #12
              </div>
            </div>

            {/* Info */}
            <div className="flex-1 text-center md:text-left">
              <h1 className="font-display text-3xl font-bold tracking-wide mb-2">
                {profile.handle}
              </h1>
              <p className="text-surface-400 mb-4">
                Trading since{' '}
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
                  className={`font-mono text-3xl font-bold ${
                    stats.totalPnlUsdc >= 0 ? 'pnl-positive' : 'pnl-negative'
                  }`}
                >
                  {stats.totalPnlUsdc >= 0 ? '+' : ''}${Math.abs(stats.totalPnlUsdc).toLocaleString()}
                </p>
                <p className="text-sm text-surface-400">Total PnL</p>
              </div>
            </div>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div className="stat-card text-center">
            <p className="text-4xl font-bold text-white mb-1">{stats.totalFights}</p>
            <p className="text-sm text-surface-400">Total Fights</p>
          </div>
          <div className="stat-card text-center">
            <p className="text-4xl font-bold text-win-400 mb-1">{stats.wins}</p>
            <p className="text-sm text-surface-400">Wins</p>
          </div>
          <div className="stat-card text-center">
            <p className="text-4xl font-bold text-loss-400 mb-1">{stats.losses}</p>
            <p className="text-sm text-surface-400">Losses</p>
          </div>
          <div className="stat-card text-center">
            <p className="text-4xl font-bold text-primary-400 mb-1">{winRate}%</p>
            <p className="text-sm text-surface-400">Win Rate</p>
          </div>
        </div>

        {/* Performance Chart Placeholder */}
        <div className="card p-6 mb-8">
          <h2 className="font-display text-xl font-semibold uppercase tracking-wide mb-4">
            Performance History
          </h2>
          <div className="h-48 bg-surface-800 rounded-lg flex items-center justify-center border border-surface-700">
            <p className="text-surface-500">Performance chart coming soon</p>
          </div>
        </div>

        {/* Fight History */}
        <div className="card overflow-hidden">
          <div className="p-5 border-b border-surface-700">
            <h2 className="font-display text-xl font-semibold uppercase tracking-wide">
              Fight History
            </h2>
          </div>
          {fights.length === 0 ? (
            <div className="p-12 text-center">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-surface-800 flex items-center justify-center">
                <span className="text-3xl opacity-50">⚔</span>
              </div>
              <p className="text-surface-400 mb-4">No fight history yet</p>
              <Link href="/lobby" className="text-primary-400 hover:text-primary-300">
                Enter the arena →
              </Link>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs text-surface-400 uppercase tracking-wider border-b border-surface-700">
                    <th className="text-left py-3 px-4">Date</th>
                    <th className="text-center py-3 px-4">Duration</th>
                    <th className="text-center py-3 px-4">Stake</th>
                    <th className="text-center py-3 px-4">Opponent</th>
                    <th className="text-center py-3 px-4">Result</th>
                    <th className="text-right py-3 px-4">PnL</th>
                  </tr>
                </thead>
                <tbody>
                  {fights.map((fight) => {
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
                          {fight.endedAt
                            ? new Date(fight.endedAt).toLocaleDateString('en-US', {
                                month: 'short',
                                day: 'numeric',
                              })
                            : 'In Progress'}
                        </td>
                        <td className="py-4 px-4 text-center text-white">{fight.durationMinutes}m</td>
                        <td className="py-4 px-4 text-center font-mono text-primary-400">
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
                              className={`font-mono font-semibold ${
                                pnlIsPositive ? 'text-emerald-400' : 'text-red-400'
                              }`}
                            >
                              {pnlIsPositive ? '+' : ''}${pnl.toFixed(2)}
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
        </div>

        {/* Actions for own profile */}
        {isOwnProfile && (
          <div className="mt-8 flex justify-center gap-4">
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
  );
}
