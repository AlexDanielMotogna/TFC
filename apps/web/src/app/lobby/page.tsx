'use client';

import { useState, useMemo, useEffect, useCallback } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useWallet } from '@solana/wallet-adapter-react';
import { useWalletModal } from '@solana/wallet-adapter-react-ui';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { FIGHT_DURATIONS_MINUTES, FIGHT_STAKES_USDC } from '@tfc/shared';
import { useAuth, useFights } from '@/hooks';
import { useGlobalSocket } from '@/hooks/useGlobalSocket';
import { api, type Fight } from '@/lib/api';
import { FightCard } from '@/components/FightCard';
import { AppShell } from '@/components/AppShell';
import { ArenaSkeleton } from '@/components/Skeletons';
import { BetaGate } from '@/components/BetaGate';
import { Spinner } from '@/components/Spinner';
import Image from 'next/image';

type ArenaTab = 'live' | 'pending' | 'finished' | 'my-fights';
const VALID_TABS: ArenaTab[] = ['live', 'pending', 'finished', 'my-fights'];

export default function LobbyPage() {
  const { connected, connecting } = useWallet();
  const { setVisible: setWalletModalVisible } = useWalletModal();
  const { isAuthenticated, isAuthenticating, user, token } = useAuth();
  const searchParams = useSearchParams();
  const router = useRouter();
  const queryClient = useQueryClient();

  // Set page title
  useEffect(() => {
    document.title = 'Arena - Trading Fight Club';
  }, []);

  // Get mutations from useFights hook
  const {
    createFight,
    joinFight,
    cancelFight,
  } = useFights();

  // Use global socket for real-time updates
  const { isConnected: wsConnected, activeFightsCount } = useGlobalSocket();

  // Read initial tab from URL or default to 'live'
  const getTabFromUrl = useCallback((): ArenaTab => {
    const tabParam = searchParams?.get('tab');
    if (tabParam && VALID_TABS.includes(tabParam as ArenaTab)) {
      return tabParam as ArenaTab;
    }
    return 'live';
  }, [searchParams]);

  const [activeTab, setActiveTabState] = useState<ArenaTab>(getTabFromUrl);
  const [showCreateModal, setShowCreateModal] = useState(false);

  // React Query - live and waiting always load (for stats), others lazy load
  const { data: liveFights = [], isLoading: isLoadingLive, error: errorLive } = useQuery({
    queryKey: ['fights', 'LIVE'],
    queryFn: () => api.getFights('LIVE'),
    staleTime: 10000, // 10s - refresh often for live fights
  });

  const { data: waitingFights = [], isLoading: isLoadingWaiting, error: errorWaiting } = useQuery({
    queryKey: ['fights', 'WAITING'],
    queryFn: () => api.getFights('WAITING'),
    staleTime: 10000, // 10s - refresh often for pending
  });

  // Lazy loaded - only fetch when tab is active
  const { data: finishedFights = [], isLoading: isLoadingFinished, error: errorFinished } = useQuery({
    queryKey: ['fights', 'FINISHED'],
    queryFn: () => api.getFights('FINISHED'),
    enabled: activeTab === 'finished',
    staleTime: 30000, // 30s - less frequent for finished
  });

  const { data: myFights = [], isLoading: isLoadingMyFights, error: errorMyFights } = useQuery({
    queryKey: ['fights', 'my'],
    queryFn: () => api.getMyFights(token!),
    enabled: activeTab === 'my-fights' && !!token,
    staleTime: 30000, // 30s - less frequent for my fights
  });

  // Combined loading state based on current tab
  const isLoading =
    (activeTab === 'live' && isLoadingLive) ||
    (activeTab === 'pending' && isLoadingWaiting) ||
    (activeTab === 'finished' && isLoadingFinished) ||
    (activeTab === 'my-fights' && isLoadingMyFights);

  // Combined error state based on current tab
  const error =
    (activeTab === 'live' && errorLive) ||
    (activeTab === 'pending' && errorWaiting) ||
    (activeTab === 'finished' && errorFinished) ||
    (activeTab === 'my-fights' && errorMyFights);

  // Refetch current tab data
  const fetchFights = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['fights'] });
  }, [queryClient]);

  // Update URL when tab changes
  const setActiveTab = useCallback((tab: ArenaTab) => {
    setActiveTabState(tab);
    // Update URL without full page reload
    const params = new URLSearchParams(searchParams?.toString() || '');
    if (tab === 'live') {
      params.delete('tab'); // Default tab, no need to show in URL
    } else {
      params.set('tab', tab);
    }
    const newUrl = params.toString() ? `/lobby?${params.toString()}` : '/lobby';
    router.replace(newUrl, { scroll: false });
  }, [router, searchParams]);

  // Sync tab state when URL changes (e.g., browser back/forward)
  useEffect(() => {
    const tabFromUrl = getTabFromUrl();
    if (tabFromUrl !== activeTab) {
      setActiveTabState(tabFromUrl);
    }
  }, [searchParams, getTabFromUrl]); // eslint-disable-line react-hooks/exhaustive-deps
  const [selectedDuration, setSelectedDuration] = useState<number>(FIGHT_DURATIONS_MINUTES[0]);
  const [selectedStake, setSelectedStake] = useState<number>(FIGHT_STAKES_USDC[0]);
  const [isCreating, setIsCreating] = useState(false);

  // Filters
  const [filterDuration, setFilterDuration] = useState<number | null>(null);
  const [filterMaxSize, setFilterMaxSize] = useState<number | null>(null);
  const [filterStatus, setFilterStatus] = useState<string | null>(null);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 9;

  // Stats calculations - only show counts for loaded tabs
  const stats = useMemo(() => {
    // Unique fighters count from all loaded fights
    const uniqueFighters = new Set<string>();
    const allFights = [...liveFights, ...waitingFights];
    allFights.forEach(f => {
      if (f.creator?.id) uniqueFighters.add(f.creator.id);
      f.participants?.forEach(p => {
        if (p.userId) uniqueFighters.add(p.userId);
      });
    });

    return {
      live: liveFights.length,
      pending: waitingFights.length,
      fighters: uniqueFighters.size
    };
  }, [liveFights, waitingFights]);

  // Get fights for current tab with filters
  const displayFights = useMemo(() => {
    let fights: typeof liveFights;
    switch (activeTab) {
      case 'live': fights = liveFights; break;
      case 'pending': fights = waitingFights; break;
      case 'finished': fights = finishedFights; break;
      case 'my-fights': fights = myFights; break;
      default: fights = [];
    }

    // Apply filters
    if (filterDuration !== null) {
      fights = fights.filter(f => f.durationMinutes === filterDuration);
    }
    if (filterMaxSize !== null) {
      fights = fights.filter(f => f.stakeUsdc === filterMaxSize);
    }
    if (filterStatus !== null) {
      fights = fights.filter(f => f.status === filterStatus);
    }

    return fights;
  }, [activeTab, liveFights, waitingFights, finishedFights, myFights, filterDuration, filterMaxSize, filterStatus]);

  // Total pages calculation
  const totalPages = Math.ceil(displayFights.length / ITEMS_PER_PAGE);

  // Paginated fights
  const paginatedFights = useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    return displayFights.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  }, [displayFights, currentPage]);

  // Reset page when tab or filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [activeTab, filterDuration, filterMaxSize, filterStatus]);

  // Check if any filter is active
  const hasActiveFilters = filterDuration !== null || filterMaxSize !== null || filterStatus !== null;

  const clearFilters = () => {
    setFilterDuration(null);
    setFilterMaxSize(null);
    setFilterStatus(null);
  };

  const handleCreateClick = () => {
    // If not connected, open wallet modal
    if (!connected) {
      setWalletModalVisible(true);
      return;
    }
    // If connected but not authenticated, wait for auth
    if (!isAuthenticated) return;
    setShowCreateModal(true);
  };

  // Wrapped mutations that invalidate React Query cache
  const handleJoinFight = async (fightId: string) => {
    const result = await joinFight(fightId);
    // Invalidate queries to refresh data
    queryClient.invalidateQueries({ queryKey: ['fights', 'WAITING'] });
    queryClient.invalidateQueries({ queryKey: ['fights', 'LIVE'] });
    queryClient.invalidateQueries({ queryKey: ['fights', 'my'] });
    return result;
  };

  const handleCancelFight = async (fightId: string) => {
    await cancelFight(fightId);
    // Invalidate queries to refresh data
    queryClient.invalidateQueries({ queryKey: ['fights', 'WAITING'] });
    queryClient.invalidateQueries({ queryKey: ['fights', 'my'] });
  };

  const handleCreateFight = async () => {
    setIsCreating(true);
    try {
      await createFight({
        durationMinutes: selectedDuration,
        stakeUsdc: selectedStake,
      });
      setShowCreateModal(false);
      // Invalidate queries to refresh data
      queryClient.invalidateQueries({ queryKey: ['fights', 'WAITING'] });
      queryClient.invalidateQueries({ queryKey: ['fights', 'my'] });
      setActiveTab('pending'); // Switch to pending tab to see the new fight
    } catch (err) {
      console.error('Failed to create fight:', err);
      alert('Failed to create fight. Please try again.');
    } finally {
      setIsCreating(false);
    }
  };

  // Only show counts for Live/Pending (always loaded), not for lazy-loaded tabs
  const tabs: { id: ArenaTab; label: string; count?: number }[] = [
    { id: 'live', label: 'Live', count: liveFights.length },
    { id: 'pending', label: 'Pending', count: waitingFights.length },
    { id: 'finished', label: 'Finished' },
    { id: 'my-fights', label: 'My Fights' },
  ];

  // Show skeleton only on initial load (live/waiting loading for the first time)
  const isInitialLoading = (isLoadingLive && liveFights.length === 0) || (isLoadingWaiting && waitingFights.length === 0);
  if (isInitialLoading) {
    return (
      <BetaGate>
      <AppShell>
        <div className="container mx-auto px-2 md:px-6 py-6">
          {/* Header */}
          <div className="mb-4">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h1 className="font-display text-2xl md:text-3xl font-bold tracking-tight text-white">Arena</h1>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-surface-500 animate-pulse" />
                  <span className="text-xs text-surface-500">...</span>
                </div>
                <div className="w-28 h-9 rounded-lg bg-surface-700 animate-pulse" />
              </div>
            </div>
          </div>
          <ArenaSkeleton />
        </div>
      </AppShell>
      </BetaGate>
    );
  }

  return (
    <BetaGate>
    <AppShell>
      <div className="relative container mx-auto px-2 md:px-6 py-6">
        {/* Bull vs Bear Background — fixed to viewport, behind content */}
        <div className="fixed inset-0 pointer-events-none select-none z-0" aria-hidden="true">
          <Image
            src="/images/background/TFC_Bull_transparent.png"
            alt=""
            width={500}
            height={500}
            className="fixed left-[-15%] sm:left-[-5%] md:left-[5%] lg:left-[15%] xl:left-[25%] top-1/2 -translate-y-1/2 w-[200px] sm:w-[250px] md:w-[300px] lg:w-[380px] opacity-[0.05] md:opacity-[0.06] invert"
            priority
          />
          <Image
            src="/images/background/TFC_Bear-transparent.png"
            alt=""
            width={500}
            height={500}
            className="fixed right-[-15%] sm:right-[-5%] md:right-[5%] lg:right-[15%] xl:right-[25%] top-1/2 -translate-y-1/2 w-[200px] sm:w-[250px] md:w-[300px] lg:w-[380px] opacity-[0.05] md:opacity-[0.06] invert"
            priority
          />
        </div>

        {/* Content layer — above background images */}
        <div className="relative z-10">

        {/* Dashboard Header */}
        <div className="mb-4">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="font-display text-2xl md:text-3xl font-bold tracking-tight text-white">Arena</h1>
            </div>
            <div className="flex items-center gap-3">
              {/* WebSocket Status */}
              <div className="flex items-center gap-1.5" title={wsConnected ? 'Real-time updates active' : 'Connecting...'}>
                <span className={`w-1.5 h-1.5 rounded-full ${wsConnected ? 'bg-win-400' : 'bg-surface-500 animate-pulse'}`} />
                <span className="text-xs text-surface-500">{wsConnected ? 'Live' : '...'}</span>
              </div>
              {/* Create Button */}
              {connecting ? (
                <button disabled className="btn-primary opacity-50">Connecting...</button>
              ) : connected && isAuthenticating ? (
                <button disabled className="btn-primary opacity-50">Signing...</button>
              ) : connected && !isAuthenticated ? (
                <button disabled className="btn-primary opacity-50">Authenticating...</button>
              ) : (
                <button onClick={handleCreateClick} className="btn-primary">+ Create Fight</button>
              )}
            </div>
          </div>

          {/* Stats Cards Row */}
          <div className="grid grid-cols-3 gap-2 mb-4">
            {/* Live Fights */}
            <div className="card p-3 sm:p-4">
              <div className="flex items-center gap-1.5 sm:gap-2 mb-2">
                <div className="w-6 h-6 sm:w-8 sm:h-8 rounded-lg bg-live-500/10 flex items-center justify-center flex-shrink-0">
                  <span className="w-2 h-2 sm:w-2.5 sm:h-2.5 bg-live-400 rounded-full animate-pulse" />
                </div>
                <span className="text-[10px] sm:text-xs text-surface-500">Live</span>
              </div>
              <p className="text-xl sm:text-2xl md:text-3xl font-bold text-white">{stats.live}</p>
            </div>

            {/* Pending Challenges */}
            <div className="card p-3 sm:p-4">
              <div className="flex items-center gap-1.5 sm:gap-2 mb-2">
                <div className="w-6 h-6 sm:w-8 sm:h-8 rounded-lg bg-amber-500/10 flex items-center justify-center flex-shrink-0">
                  <span className="text-xs sm:text-sm leading-none" style={{ color: '#facc15' }}>&#x2694;</span>
                </div>
                <span className="text-[10px] sm:text-xs text-surface-500">Pending</span>
              </div>
              <p className="text-xl sm:text-2xl md:text-3xl font-bold text-white">{stats.pending}</p>
            </div>

            {/* Active Fighters */}
            <div className="card p-3 sm:p-4">
              <div className="flex items-center gap-1.5 sm:gap-2 mb-2">
                <div className="w-6 h-6 sm:w-8 sm:h-8 rounded-lg bg-primary-500/10 flex items-center justify-center flex-shrink-0">
                  <span className="text-xs sm:text-sm leading-none" style={{ color: '#5196c9' }}>&#x2694;</span>
                </div>
                <span className="text-[10px] sm:text-xs text-surface-500">Fighters</span>
              </div>
              <p className="text-xl sm:text-2xl md:text-3xl font-bold text-white">{stats.fighters}</p>
            </div>
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-2 p-4 bg-loss-500/20 border border-loss-500/30 rounded-lg text-loss-400 text-center">
            {error instanceof Error ? error.message : 'Failed to load fights'}
            <button
              onClick={() => fetchFights()}
              className="ml-4 underline hover:no-underline"
            >
              Retry
            </button>
          </div>
        )}

        {/* Tabs + Filters Row */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-4">
          {/* Tabs */}
          <div className="bg-surface-800 rounded-xl p-1 flex w-full sm:w-auto border border-surface-800">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex-1 sm:flex-none px-3 sm:px-4 py-1.5 rounded-lg text-xs sm:text-sm font-semibold transition-all whitespace-nowrap ${
                  activeTab === tab.id
                    ? 'bg-surface-700 text-white'
                    : 'text-surface-400 hover:text-white'
                }`}
              >
                {tab.label}
                {tab.count !== undefined && tab.count > 0 && (
                  <span className={`ml-1.5 px-1.5 py-0.5 text-[10px] rounded ${
                    activeTab === tab.id
                      ? 'bg-primary-500/20 text-primary-400'
                      : 'bg-surface-600 text-surface-400'
                  }`}>
                    {tab.count}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* Filters */}
          <div className="flex items-center gap-2">
            {/* Status Filter - only show on My Fights tab */}
            {activeTab === 'my-fights' && (
              <select
                value={filterStatus ?? ''}
                onChange={(e) => setFilterStatus(e.target.value || null)}
                className="bg-surface-800 border border-surface-800 rounded-lg px-2 py-1.5 text-xs text-surface-300 focus:outline-none focus:border-primary-500"
              >
                <option value="">All Status</option>
                <option value="WAITING">Waiting</option>
                <option value="LIVE">Live</option>
                <option value="FINISHED">Finished</option>
                <option value="CANCELLED">Cancelled</option>
              </select>
            )}

            {/* Duration Filter */}
            <select
              value={filterDuration ?? ''}
              onChange={(e) => setFilterDuration(e.target.value ? Number(e.target.value) : null)}
              className="bg-surface-800 border border-surface-800 rounded-lg px-2 py-1.5 text-xs text-surface-300 focus:outline-none focus:border-primary-500"
            >
              <option value="">All Durations</option>
              {FIGHT_DURATIONS_MINUTES.map((d) => (
                <option key={d} value={d}>{d}m</option>
              ))}
            </select>

            {/* Max Size Filter */}
            <select
              value={filterMaxSize ?? ''}
              onChange={(e) => setFilterMaxSize(e.target.value ? Number(e.target.value) : null)}
              className="bg-surface-800 border border-surface-800 rounded-lg px-2 py-1.5 text-xs text-surface-300 focus:outline-none focus:border-primary-500"
            >
              <option value="">All Sizes</option>
              {FIGHT_STAKES_USDC.map((s) => (
                <option key={s} value={s}>${s.toLocaleString()}</option>
              ))}
            </select>

            {/* Clear Filters */}
            {hasActiveFilters && (
              <button
                onClick={clearFilters}
                className="text-xs text-surface-400 hover:text-white px-2 py-1"
              >
                Clear
              </button>
            )}
          </div>
        </div>

        {/* Tab Content */}
        {isLoading ? (
          <div className="text-center py-16 min-h-[200px] flex flex-col items-center justify-center">
            <div className="flex flex-col items-center gap-3">
              <Spinner size="md" />
              <span className="text-sm text-surface-400">Loading fights...</span>
            </div>
          </div>
        ) : displayFights.length === 0 ? (
          <div className="text-center py-16 min-h-[200px] flex flex-col items-center justify-center">
            <p className="text-surface-400 text-sm sm:text-lg mb-4">
              {hasActiveFilters ? (
                'No fights match your filters'
              ) : (
                <>
                  {activeTab === 'live' && 'No live battles right now'}
                  {activeTab === 'pending' && 'No pending challenges'}
                  {activeTab === 'finished' && 'No finished fights yet'}
                  {activeTab === 'my-fights' && 'You haven\'t participated in any fights'}
                </>
              )}
            </p>
            {hasActiveFilters ? (
              <button
                onClick={clearFilters}
                className="text-primary-400 hover:text-primary-300 font-medium"
              >
                Clear filters →
              </button>
            ) : (
              <>
                {(activeTab === 'live' || activeTab === 'pending' || activeTab === 'finished' || activeTab === 'my-fights') && connected && isAuthenticated && (
                  <button
                    onClick={handleCreateClick}
                    className="text-primary-400 hover:text-primary-300 font-medium"
                  >
                    Create the first challenge →
                  </button>
                )}
              </>
            )}
          </div>
        ) : (
          <div className="flex flex-col">
            {/* Fixed height container for 3 rows of cards (240px each + 16px gaps) */}
            <div className="min-h-[752px]">
              <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-3 content-start">
                {paginatedFights.map((fight) => (
                  <FightCard key={fight.id} fight={fight} onJoinFight={handleJoinFight} onCancelFight={handleCancelFight} />
                ))}
              </div>
            </div>

            {/* Pagination - always in same position */}
            <div className="h-16 flex items-center justify-center gap-2">
              {totalPages > 1 ? (
                <>
                  <button
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="px-3 py-2 rounded-lg bg-surface-800 text-surface-400 hover:bg-surface-700 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    ←
                  </button>

                  {(() => {
                    const pages: (number | 'ellipsis')[] = [];
                    if (totalPages <= 5) {
                      // Show all pages if 5 or less
                      for (let i = 1; i <= totalPages; i++) pages.push(i);
                    } else {
                      // Always show first page
                      pages.push(1);

                      if (currentPage > 3) {
                        pages.push('ellipsis');
                      }

                      // Pages around current
                      const start = Math.max(2, currentPage - 1);
                      const end = Math.min(totalPages - 1, currentPage + 1);
                      for (let i = start; i <= end; i++) {
                        if (!pages.includes(i)) pages.push(i);
                      }

                      if (currentPage < totalPages - 2) {
                        pages.push('ellipsis');
                      }

                      // Always show last page
                      if (!pages.includes(totalPages)) pages.push(totalPages);
                    }

                    return pages.map((page, idx) =>
                      page === 'ellipsis' ? (
                        <span key={`ellipsis-${idx}`} className="px-2 text-surface-500">...</span>
                      ) : (
                        <button
                          key={page}
                          onClick={() => setCurrentPage(page)}
                          className={`w-10 h-10 rounded-lg font-medium transition-colors ${
                            currentPage === page
                              ? 'bg-primary-500 text-white'
                              : 'bg-surface-800 text-surface-400 hover:bg-surface-700 hover:text-white'
                          }`}
                        >
                          {page}
                        </button>
                      )
                    );
                  })()}

                  <button
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                    className="px-3 py-2 rounded-lg bg-surface-800 text-surface-400 hover:bg-surface-700 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    →
                  </button>
                </>
              ) : (
                <span className="text-surface-600 text-sm">Page 1 of 1</span>
              )}
            </div>

          </div>
        )}
      {/* Create Fight Modal */}
      {showCreateModal && (
        <div className="modal-overlay" onClick={() => setShowCreateModal(false)}>
          <div className="modal-content p-6 max-w-md" onClick={(e) => e.stopPropagation()}>
            {/* Modal Header */}
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-display text-sm sm:text-xl font-bold uppercase tracking-wide">
                Create Fight
              </h3>
              <button
                onClick={() => setShowCreateModal(false)}
                className="w-8 h-8 rounded-lg bg-surface-800 hover:bg-surface-700 flex items-center justify-center text-surface-400 hover:text-white transition-colors"
              >
                ✕
              </button>
            </div>

            {/* Duration Selection */}
            <div className="mb-5">
              <label className="block text-xs font-medium text-surface-400 mb-2 uppercase tracking-wider">
                Duration
              </label>
              <div className="grid grid-cols-3 gap-2">
                {FIGHT_DURATIONS_MINUTES.map((duration) => (
                  <button
                    key={duration}
                    onClick={() => setSelectedDuration(duration)}
                    className={`py-2.5 rounded-lg font-semibold text-sm transition-all ${
                      selectedDuration === duration
                        ? 'bg-gradient-to-r from-primary-600 to-primary-500 text-white shadow-glow-sm'
                        : 'bg-surface-800 text-surface-400 hover:bg-surface-700 hover:text-white border border-surface-800'
                    }`}
                  >
                    {duration}m
                  </button>
                ))}
              </div>
            </div>

            {/* Max Trading Size Selection */}
            <div className="mb-2">
              <label className="block text-xs font-medium text-surface-400 mb-2 uppercase tracking-wider">
                Max Trading Size (USDC)
              </label>
              <div className="grid grid-cols-3 gap-2">
                {FIGHT_STAKES_USDC.map((stake) => (
                  <button
                    key={stake}
                    onClick={() => setSelectedStake(stake)}
                    className={`py-2.5 rounded-lg font-semibold text-sm transition-all ${
                      selectedStake === stake
                        ? 'bg-gradient-to-r from-primary-600 to-primary-500 text-white shadow-glow-sm'
                        : 'bg-surface-800 text-surface-400 hover:bg-surface-700 hover:text-white border border-surface-800'
                    }`}
                  >
                    ${stake.toLocaleString()}
                  </button>
                ))}
              </div>
            </div>

            {/* Summary */}
            <div className="bg-surface-800 rounded-xl p-4 mb-5 border border-surface-800">
              <div className="flex justify-between text-sm mb-2">
                <span className="text-surface-400">Duration</span>
                <span className="text-white font-medium">{selectedDuration} min</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-surface-400">Max Trading Size</span>
                <span className="text-white font-medium">${selectedStake.toLocaleString()}</span>
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-3">
              <button
                onClick={() => setShowCreateModal(false)}
                className="btn-secondary flex-1"
                disabled={isCreating}
              >
                Cancel
              </button>
              <button
                onClick={handleCreateFight}
                className="btn-primary flex-1"
                disabled={isCreating}
              >
                {isCreating ? (
                  <div className="flex items-center justify-center gap-2">
                    <Spinner size="xs" />
                    <span>Creating...</span>
                  </div>
                ) : (
                  'Create'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
      </div>{/* end z-10 content layer */}
      </div>
    </AppShell>
    </BetaGate>
  );
}
