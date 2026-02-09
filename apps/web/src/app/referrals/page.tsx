'use client';

import { useEffect, useState, useCallback } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { AppShell } from '@/components/AppShell';
import { BetaGate } from '@/components/BetaGate';
import { useAuth } from '@/hooks/useAuth';
import { api } from '@/lib/api';
import ShareIcon from '@mui/icons-material/Share';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import GroupsIcon from '@mui/icons-material/Groups';
import AttachMoneyIcon from '@mui/icons-material/AttachMoney';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import { toast } from 'sonner';

type ReferralTab = 'overview' | 'referrals' | 'payouts';
const VALID_TABS: ReferralTab[] = ['overview', 'referrals', 'payouts'];

export default function ReferralsPage() {
  const { token, isAuthenticated } = useAuth();
  const queryClient = useQueryClient();
  const searchParams = useSearchParams();
  const router = useRouter();

  // Read initial tab from URL or default to 'overview'
  const getTabFromUrl = useCallback((): ReferralTab => {
    const tabParam = searchParams?.get('tab');
    if (tabParam && VALID_TABS.includes(tabParam as ReferralTab)) {
      return tabParam as ReferralTab;
    }
    return 'overview';
  }, [searchParams]);

  const [activeTab, setActiveTabState] = useState<ReferralTab>(getTabFromUrl);

  // Update URL when tab changes
  const setActiveTab = useCallback((tab: ReferralTab) => {
    setActiveTabState(tab);
    const params = new URLSearchParams(searchParams?.toString() || '');
    if (tab === 'overview') {
      params.delete('tab'); // Default tab, no need to show in URL
    } else {
      params.set('tab', tab);
    }
    const newUrl = params.toString() ? `/referrals?${params.toString()}` : '/referrals';
    router.replace(newUrl, { scroll: false });
  }, [router, searchParams]);

  // Sync tab state when URL changes (e.g., browser back/forward)
  useEffect(() => {
    const tabFromUrl = getTabFromUrl();
    if (tabFromUrl !== activeTab) {
      setActiveTabState(tabFromUrl);
    }
  }, [searchParams, getTabFromUrl]); // eslint-disable-line react-hooks/exhaustive-deps

  // Set page title
  useEffect(() => {
    document.title = 'Referrals - Trading Fight Club';
  }, []);

  // Fetch dashboard data
  const { data: dashboard, isLoading, error } = useQuery({
    queryKey: ['referral-dashboard', token],
    queryFn: () => api.getReferralDashboard(token!),
    enabled: !!token && isAuthenticated,
    staleTime: 30000, // 30 seconds
  });

  // Fetch minimum payout amount configuration
  const { data: config } = useQuery({
    queryKey: ['referral-claim-config'],
    queryFn: async () => {
      const response = await fetch('/api/referrals/claim');
      if (!response.ok) throw new Error('Failed to fetch config');
      return response.json() as Promise<{ minPayoutAmount: number }>;
    },
    staleTime: 60000, // 1 minute (config doesn't change often)
  });

  const minPayoutAmount = config?.minPayoutAmount ?? 10; // Default to 10 if not loaded yet

  // Claim payout mutation
  const claimMutation = useMutation({
    mutationFn: () => api.claimReferralPayout(token!),
    onSuccess: (data) => {
      toast.success(data.message);
      queryClient.invalidateQueries({ queryKey: ['referral-dashboard'] });
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to claim payout');
    },
  });

  const handleCopyCode = () => {
    if (dashboard?.referralCode) {
      navigator.clipboard.writeText(dashboard.referralCode);
      toast.success('Referral code copied!');
    }
  };

  const handleCopyLink = () => {
    if (dashboard?.referralCode) {
      const link = `${window.location.origin}?ref=${dashboard.referralCode}`;
      navigator.clipboard.writeText(link);
      toast.success('Referral link copied!');
    }
  };

  const handleClaimPayout = () => {
    if (!dashboard) return;

    if (dashboard.unclaimedPayout < minPayoutAmount) {
      toast.error(`Minimum payout amount is $${minPayoutAmount.toFixed(2)}`);
      return;
    }

    claimMutation.mutate();
  };

  // Not authenticated state
  if (!isAuthenticated || !token) {
    return (
      <BetaGate>
        <AppShell>
          <div className="container mx-auto px-2 md:px-6 py-8">
            <div className="card p-12 text-center">
              <GroupsIcon sx={{ fontSize: 64, color: '#52525b', marginBottom: 16 }} />
              <h3 className="text-lg font-semibold text-surface-300 mb-2">Connect your wallet</h3>
              <p className="text-surface-500">Please connect your wallet to access the referral system.</p>
            </div>
          </div>
        </AppShell>
      </BetaGate>
    );
  }

  // Loading state
  if (isLoading) {
    return (
      <BetaGate>
        <AppShell>
          <div className="container mx-auto px-2 md:px-6 py-8">
            <div className="animate-pulse space-y-2">
              {/* Header Skeleton */}
              <div className="flex items-center gap-3">
                <div className="w-7 h-7 bg-surface-700" />
                <div>
                  <div className="h-6 w-40 bg-surface-700 mb-1" />
                  <div className="h-3 w-48 bg-surface-700" />
                </div>
              </div>

              {/* Top Cards Skeleton */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-2">
                {/* Referral Code Card */}
                <div className="card p-6">
                  <div className="h-4 w-32 bg-surface-700 mb-4" />
                  <div className="h-12 bg-surface-700 mb-4" />
                  <div className="flex gap-2">
                    <div className="flex-1 h-10 bg-surface-700" />
                    <div className="flex-1 h-10 bg-surface-700" />
                  </div>
                </div>
                {/* Unclaimed Earnings Card */}
                <div className="card p-6">
                  <div className="h-4 w-36 bg-surface-700 mb-4" />
                  <div className="h-10 w-24 bg-surface-700 mb-4" />
                  <div className="h-12 bg-surface-700" />
                </div>
              </div>

              {/* Stats Cards Skeleton */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="card p-6">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-10 h-10 bg-surface-700" />
                      <div className="h-4 w-24 bg-surface-700" />
                    </div>
                    <div className="h-8 w-20 bg-surface-700 mb-2" />
                    <div className="h-3 w-32 bg-surface-700" />
                  </div>
                ))}
              </div>

              {/* Tabs Skeleton */}
              <div className="h-12 w-72 bg-surface-700" />

              {/* Table Skeleton */}
              <div className="card">
                <div className="p-6 border-b border-surface-800">
                  <div className="h-4 w-32 bg-surface-700" />
                </div>
                <div className="p-4 space-y-2">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="flex items-center justify-between py-2">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-surface-700" />
                        <div className="h-4 w-24 bg-surface-700" />
                      </div>
                      <div className="h-6 w-12 bg-surface-700" />
                      <div className="h-4 w-20 bg-surface-700" />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </AppShell>
      </BetaGate>
    );
  }

  // Error state
  if (error) {
    return (
      <BetaGate>
        <AppShell>
          <div className="container mx-auto px-2 md:px-6 py-8">
            <div className="card p-8 text-center">
              <p className="text-loss-400 mb-4">{(error as Error).message}</p>
              <button
                onClick={() => window.location.reload()}
                className="text-primary-400 hover:text-primary-300"
              >
                Try again
              </button>
            </div>
          </div>
        </AppShell>
      </BetaGate>
    );
  }

  // No dashboard data
  if (!dashboard) {
    return (
      <BetaGate>
        <AppShell>
          <div className="container mx-auto px-2 md:px-6 py-8">
            <div className="card p-12 text-center">
              <GroupsIcon sx={{ fontSize: 64, color: '#52525b', marginBottom: 16 }} />
              <h3 className="text-lg font-semibold text-surface-300 mb-2">Referral system unavailable</h3>
              <p className="text-surface-500">Please try again later.</p>
            </div>
          </div>
        </AppShell>
      </BetaGate>
    );
  }

  return (
    <BetaGate>
      <AppShell>
        <div className="container mx-auto px-2 md:px-6 py-8">
          {/* Header */}
          <div className="flex items-center gap-3 mb-2">
            <GroupsIcon sx={{ color: '#f97316', fontSize: 28 }} />
            <div>
              <h1 className="font-display text-xl sm:text-2xl font-bold text-white">Referral Program</h1>
              <p className="text-surface-400 text-xs sm:text-sm">Earn {dashboard.commissionRates.t1}% commission on referrals</p>
            </div>
          </div>

          {/* Top Cards Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-2 mb-2">
            {/* Referral Code Card */}
            <div className="card p-6">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-surface-300 mb-4">
                Your Referral Code
              </h2>
              <div className="bg-surface-900 rounded-lg p-4 mb-4 border border-surface-800">
                <p className="text-sm sm:text-2xl font-mono font-bold text-primary-400 text-center tracking-wider">
                  {dashboard.referralCode}
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleCopyCode}
                  className="flex-1 btn-secondary text-sm py-2 flex items-center justify-center gap-2"
                >
                  <ContentCopyIcon sx={{ fontSize: 18 }} />
                  Copy Code
                </button>
                <button
                  onClick={handleCopyLink}
                  className="flex-1 btn-primary text-sm py-2 flex items-center justify-center gap-2"
                >
                  <ShareIcon sx={{ fontSize: 18 }} />
                  Copy Link
                </button>
              </div>
            </div>

            {/* Unclaimed Payout Card */}
            <div className="card p-6 bg-gradient-to-br from-surface-900 to-surface-800 border-primary-500/20">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-surface-300 mb-4">
                Unclaimed Earnings
              </h2>
              <div className="mb-4">
                <p className="text-lg sm:text-4xl font-bold text-white mb-1">
                  ${dashboard.unclaimedPayout.toFixed(2)}
                </p>
                <p className="text-xs text-surface-500">Minimum ${minPayoutAmount.toFixed(2)} to claim</p>
              </div>
              <button
                onClick={handleClaimPayout}
                disabled={dashboard.unclaimedPayout < minPayoutAmount || claimMutation.isPending}
                className={`w-full py-3 rounded-lg font-semibold transition-all ${
                  dashboard.unclaimedPayout >= minPayoutAmount && !claimMutation.isPending
                    ? 'bg-gradient-to-r from-primary-600 to-primary-500 text-white hover:shadow-glow-sm'
                    : 'bg-surface-700 text-surface-500 cursor-not-allowed'
                }`}
              >
                {claimMutation.isPending ? 'Processing...' : 'Claim Payout'}
              </button>
            </div>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2 mb-2">
            {/* Total Referrals */}
            <div className="card p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-lg bg-primary-500/10 flex items-center justify-center">
                  <GroupsIcon sx={{ color: '#f97316', fontSize: 24 }} />
                </div>
                <h3 className="text-sm font-semibold text-surface-300">Total Referrals</h3>
              </div>
              <p className="text-base sm:text-3xl font-bold text-white mb-2">{dashboard.totalReferrals.total}</p>
              <div className="flex gap-3 text-xs text-surface-400">
                <span>T1: {dashboard.totalReferrals.t1}</span>
                <span>T2: {dashboard.totalReferrals.t2}</span>
                <span>T3: {dashboard.totalReferrals.t3}</span>
              </div>
            </div>

            {/* Total Earnings */}
            <div className="card p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-lg bg-win-500/10 flex items-center justify-center">
                  <AttachMoneyIcon sx={{ color: '#10b981', fontSize: 24 }} />
                </div>
                <h3 className="text-sm font-semibold text-surface-300">Total Earnings</h3>
              </div>
              <p className="text-base sm:text-3xl font-bold text-white mb-2">${dashboard.totalEarnings.total.toFixed(2)}</p>
              <div className="flex gap-3 text-xs text-surface-400">
                <span>T1: ${dashboard.totalEarnings.t1.toFixed(2)}</span>
                <span>T2: ${dashboard.totalEarnings.t2.toFixed(2)}</span>
                <span>T3: ${dashboard.totalEarnings.t3.toFixed(2)}</span>
              </div>
            </div>

            {/* Referral Volume */}
            <div className="card p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-lg bg-accent-500/10 flex items-center justify-center">
                  <TrendingUpIcon sx={{ color: '#facc15', fontSize: 24 }} />
                </div>
                <h3 className="text-sm font-semibold text-surface-300">Referral Volume</h3>
              </div>
              <p className="text-base sm:text-3xl font-bold text-white mb-2">${dashboard.referralVolume.total.toFixed(2)}</p>
              <div className="flex gap-3 text-xs text-surface-400">
                <span>T1: ${dashboard.referralVolume.t1.toFixed(2)}</span>
                <span>T2: ${dashboard.referralVolume.t2.toFixed(2)}</span>
                <span>T3: ${dashboard.referralVolume.t3.toFixed(2)}</span>
              </div>
            </div>
          </div>

          {/* Tabs */}
          <div className="mb-2">
            <div className="bg-surface-800 rounded-xl p-1.5 inline-flex border border-surface-800">
              <button
                onClick={() => setActiveTab('overview')}
                className={`px-6 py-2.5 rounded-lg font-semibold transition-all ${
                  activeTab === 'overview'
                    ? 'bg-surface-700 text-white'
                    : 'text-surface-400 hover:text-white'
                }`}
              >
                Overview
              </button>
              <button
                onClick={() => setActiveTab('referrals')}
                className={`px-6 py-2.5 rounded-lg font-semibold transition-all ${
                  activeTab === 'referrals'
                    ? 'bg-surface-700 text-white'
                    : 'text-surface-400 hover:text-white'
                }`}
              >
                Referrals
              </button>
              <button
                onClick={() => setActiveTab('payouts')}
                className={`px-6 py-2.5 rounded-lg font-semibold transition-all ${
                  activeTab === 'payouts'
                    ? 'bg-surface-700 text-white'
                    : 'text-surface-400 hover:text-white'
                }`}
              >
                Payouts
              </button>
            </div>
          </div>

          {/* Tab Content */}
          {activeTab === 'overview' && (
            <div className="space-y-6">
              {/* Recent Referrals */}
              <div className="card">
                <div className="p-6 border-b border-surface-800">
                  <h3 className="text-sm font-semibold uppercase tracking-wide text-surface-300">
                    Recent Referrals
                  </h3>
                </div>
                {dashboard.recentReferrals.length === 0 ? (
                  <div className="p-12 text-center">
                    <GroupsIcon sx={{ fontSize: 48, color: '#52525b', marginBottom: 8 }} />
                    <p className="text-surface-500 text-sm">No referrals yet</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="table-premium w-full">
                      <thead>
                        <tr className="bg-surface-850">
                          <th className="py-3 px-4 text-left text-xs font-medium text-surface-400">User</th>
                          <th className="py-3 px-4 text-center text-xs font-medium text-surface-400">Tier</th>
                          <th className="py-3 px-4 text-right text-xs font-medium text-surface-400">Joined</th>
                        </tr>
                      </thead>
                      <tbody>
                        {dashboard.recentReferrals.map((ref, index) => (
                          <tr key={ref.id} className={`transition-colors ${index % 2 === 0 ? 'bg-surface-800/30' : ''} hover:bg-surface-800/50`}>
                            <td className="py-3 px-4">
                              <div className="flex items-center gap-2">
                                <div className="avatar w-8 h-8 text-xs">
                                  {ref.user.handle[0]?.toUpperCase() || '?'}
                                </div>
                                <span className="text-white text-sm">{ref.user.handle}</span>
                              </div>
                            </td>
                            <td className="py-3 px-4 text-center">
                              <span className="px-2 py-1 rounded bg-primary-500/10 text-primary-400 text-xs font-medium">
                                T{ref.tier}
                              </span>
                            </td>
                            <td className="py-3 px-4 text-right text-surface-400 text-sm">
                              {new Date(ref.joinedAt).toLocaleDateString()}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Recent Earnings */}
              <div className="card">
                <div className="p-6 border-b border-surface-800">
                  <h3 className="text-sm font-semibold uppercase tracking-wide text-surface-300">
                    Recent Earnings
                  </h3>
                </div>
                {dashboard.recentEarnings.length === 0 ? (
                  <div className="p-12 text-center">
                    <AttachMoneyIcon sx={{ fontSize: 48, color: '#52525b', marginBottom: 8 }} />
                    <p className="text-surface-500 text-sm">No earnings yet</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="table-premium w-full">
                      <thead>
                        <tr className="bg-surface-850">
                          <th className="py-3 px-4 text-left text-xs font-medium text-surface-400">Symbol</th>
                          <th className="py-3 px-4 text-center text-xs font-medium text-surface-400">Tier</th>
                          <th className="py-3 px-4 text-right text-xs font-medium text-surface-400">Amount</th>
                          <th className="py-3 px-4 text-center text-xs font-medium text-surface-400">Status</th>
                          <th className="py-3 px-4 text-right text-xs font-medium text-surface-400">Date</th>
                        </tr>
                      </thead>
                      <tbody>
                        {dashboard.recentEarnings.map((earning, index) => (
                          <tr key={earning.id} className={`transition-colors ${index % 2 === 0 ? 'bg-surface-800/30' : ''} hover:bg-surface-800/50`}>
                            <td className="py-3 px-4 text-white font-medium">{earning.symbol}</td>
                            <td className="py-3 px-4 text-center">
                              <span className="px-2 py-1 rounded bg-primary-500/10 text-primary-400 text-xs font-medium">
                                T{earning.tier}
                              </span>
                            </td>
                            <td className="py-3 px-4 text-right text-win-400 font-medium">
                              ${Number(earning.commissionAmount).toFixed(2)}
                            </td>
                            <td className="py-3 px-4 text-center">
                              <span
                                className={`px-2 py-1 rounded text-xs font-medium ${
                                  earning.isPaid
                                    ? 'bg-win-500/10 text-win-400'
                                    : 'bg-surface-700 text-surface-400'
                                }`}
                              >
                                {earning.isPaid ? 'Paid' : 'Pending'}
                              </span>
                            </td>
                            <td className="py-3 px-4 text-right text-surface-400 text-sm">
                              {new Date(earning.earnedAt).toLocaleDateString()}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'referrals' && (
            <div className="card">
              <div className="p-6 border-b border-surface-800">
                <h3 className="text-sm font-semibold uppercase tracking-wide text-surface-300">
                  All Referrals
                </h3>
              </div>
              {dashboard.recentReferrals.length === 0 ? (
                <div className="p-12 text-center">
                  <GroupsIcon sx={{ fontSize: 48, color: '#52525b', marginBottom: 8 }} />
                  <p className="text-surface-500 text-sm">No referrals yet</p>
                  <p className="text-surface-600 text-xs mt-2">Share your referral link to start earning commissions</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="table-premium w-full">
                    <thead>
                      <tr className="bg-surface-850">
                        <th className="py-3 px-4 text-left text-xs font-medium text-surface-400">User</th>
                        <th className="py-3 px-4 text-center text-xs font-medium text-surface-400">Tier</th>
                        <th className="py-3 px-4 text-center text-xs font-medium text-surface-400">Commission</th>
                        <th className="py-3 px-4 text-right text-xs font-medium text-surface-400">Joined</th>
                      </tr>
                    </thead>
                    <tbody>
                      {dashboard.recentReferrals.map((ref, index) => (
                        <tr key={ref.id} className={`transition-colors ${index % 2 === 0 ? 'bg-surface-800/30' : ''} hover:bg-surface-800/50`}>
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-2">
                              <div className="avatar w-8 h-8 text-xs">
                                {ref.user.handle[0]?.toUpperCase() || '?'}
                              </div>
                              <div>
                                <span className="text-white text-sm block">{ref.user.handle}</span>
                                <span className="text-surface-500 text-xs font-mono">
                                  {ref.user.walletAddress ? `${ref.user.walletAddress.slice(0, 4)}...${ref.user.walletAddress.slice(-4)}` : '-'}
                                </span>
                              </div>
                            </div>
                          </td>
                          <td className="py-3 px-4 text-center">
                            <span className={`px-2 py-1 rounded text-xs font-medium ${
                              ref.tier === 1 ? 'bg-primary-500/10 text-primary-400' :
                              ref.tier === 2 ? 'bg-violet-500/10 text-violet-400' :
                              'bg-surface-700 text-surface-400'
                            }`}>
                              T{ref.tier}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-center text-surface-300 text-sm">
                            {ref.tier === 1 ? dashboard.commissionRates.t1 :
                             ref.tier === 2 ? dashboard.commissionRates.t2 :
                             dashboard.commissionRates.t3}%
                          </td>
                          <td className="py-3 px-4 text-right text-surface-400 text-sm">
                            {new Date(ref.joinedAt).toLocaleDateString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {activeTab === 'payouts' && (
            <div className="card">
              <div className="p-6 border-b border-surface-800">
                <h3 className="text-sm font-semibold uppercase tracking-wide text-surface-300">
                  Payout History
                </h3>
              </div>
              {dashboard.payoutHistory.length === 0 ? (
                <div className="p-12 text-center">
                  <AttachMoneyIcon sx={{ fontSize: 48, color: '#52525b', marginBottom: 8 }} />
                  <p className="text-surface-500 text-sm">No payouts yet</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="table-premium w-full">
                    <thead>
                      <tr className="bg-surface-850">
                        <th className="py-3 px-4 text-left text-xs font-medium text-surface-400">Date</th>
                        <th className="py-3 px-4 text-right text-xs font-medium text-surface-400">Amount</th>
                        <th className="py-3 px-4 text-center text-xs font-medium text-surface-400">Status</th>
                        <th className="py-3 px-4 text-left text-xs font-medium text-surface-400">Tx Signature</th>
                        <th className="py-3 px-4 text-left text-xs font-medium text-surface-400">Wallet</th>
                      </tr>
                    </thead>
                    <tbody>
                      {dashboard.payoutHistory.map((payout, index) => (
                        <tr key={payout.id} className={`transition-colors ${index % 2 === 0 ? 'bg-surface-800/30' : ''} hover:bg-surface-800/50`}>
                          <td className="py-3 px-4 text-surface-400 text-sm">
                            {new Date(payout.createdAt).toLocaleDateString()}
                          </td>
                          <td className="py-3 px-4 text-right text-white font-medium">
                            ${Number(payout.amount).toFixed(2)}
                          </td>
                          <td className="py-3 px-4 text-center">
                            <span
                              className={`px-2 py-1 rounded text-xs font-medium ${
                                payout.status === 'completed'
                                  ? 'bg-win-500/10 text-win-400'
                                  : payout.status === 'processing'
                                  ? 'bg-accent-500/10 text-accent-400'
                                  : payout.status === 'failed'
                                  ? 'bg-loss-500/10 text-loss-400'
                                  : 'bg-surface-700 text-surface-400'
                              }`}
                            >
                              {payout.status}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-surface-400 text-sm font-mono">
                            {payout.txSignature ? (
                              <a
                                href={`https://solscan.io/tx/${payout.txSignature}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="hover:text-primary-400 transition-colors"
                              >
                                {payout.txSignature.slice(0, 4)}...{payout.txSignature.slice(-4)}
                              </a>
                            ) : (
                              <span className="text-surface-500">-</span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-surface-400 text-sm font-mono">
                            {payout.walletAddress.slice(0, 8)}...{payout.walletAddress.slice(-6)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* Commission Info */}
          <div className="mt-8 card p-6">
            <h2 className="font-display text-xs font-semibold uppercase tracking-wide text-surface-300 mb-4">
              How It Works
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-xs text-surface-400">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <span className="w-6 h-6 rounded-full bg-primary-500/20 flex items-center justify-center text-primary-400 font-bold text-[10px]">
                    T1
                  </span>
                  <span className="text-white font-medium">{dashboard.commissionRates.t1}% Commission</span>
                </div>
                <p>Direct referrals - users who sign up with your code</p>
              </div>
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <span className="w-6 h-6 rounded-full bg-primary-500/20 flex items-center justify-center text-primary-400 font-bold text-[10px]">
                    T2
                  </span>
                  <span className="text-white font-medium">{dashboard.commissionRates.t2}% Commission</span>
                </div>
                <p>Indirect referrals - users referred by your T1 referrals</p>
              </div>
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <span className="w-6 h-6 rounded-full bg-primary-500/20 flex items-center justify-center text-primary-400 font-bold text-[10px]">
                    T3
                  </span>
                  <span className="text-white font-medium">{dashboard.commissionRates.t3}% Commission</span>
                </div>
                <p>Third-tier referrals - users referred by your T2 referrals</p>
              </div>
            </div>
            <p className="mt-4 text-xs text-surface-500">
              Earn commissions on all trading fees paid by your referrals. Minimum $10 payout.
            </p>
          </div>
        </div>
      </AppShell>
    </BetaGate>
  );
}
