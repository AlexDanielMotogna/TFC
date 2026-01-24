'use client';

import { useState, useMemo, useEffect } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { useWalletModal } from '@solana/wallet-adapter-react-ui';
import { FIGHT_DURATIONS_MINUTES, FIGHT_STAKES_USDC } from '@tfc/shared';
import { useAuth, useFights } from '@/hooks';
import { useGlobalSocket } from '@/hooks/useGlobalSocket';
import { FightCard } from '@/components/FightCard';
import { AppShell } from '@/components/AppShell';
import { ArenaSkeleton } from '@/components/Skeletons';

type ArenaTab = 'live' | 'pending' | 'finished' | 'my-fights';

export default function LobbyPage() {
  const { connected, connecting } = useWallet();
  const { setVisible: setWalletModalVisible } = useWalletModal();
  const { isAuthenticated, isAuthenticating, user } = useAuth();

  // Set page title
  useEffect(() => {
    document.title = 'Arena - Trading Fight Club';
  }, []);
  const {
    fights,
    waitingFights,
    liveFights,
    finishedFights,
    isLoading,
    error,
    createFight,
    joinFight,
    cancelFight,
    fetchFights
  } = useFights();

  // Use global socket for real-time updates
  const { isConnected: wsConnected, activeFightsCount } = useGlobalSocket();

  const [activeTab, setActiveTab] = useState<ArenaTab>('live');
  const [showCreateModal, setShowCreateModal] = useState(false);
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

  // My fights - where the current user is a participant
  const myFights = useMemo(() => {
    if (!user?.id) return [];
    return fights.filter(f =>
      f.creator?.id === user.id ||
      f.participants?.some(p => p.userId === user.id)
    );
  }, [fights, user?.id]);

  // Stats calculations
  const stats = useMemo(() => {
    // Unique fighters count
    const uniqueFighters = new Set<string>();
    fights.forEach(f => {
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
  }, [fights, liveFights.length, waitingFights.length]);

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

  const handleCreateFight = async () => {
    setIsCreating(true);
    try {
      await createFight({
        durationMinutes: selectedDuration,
        stakeUsdc: selectedStake,
      });
      setShowCreateModal(false);
      setActiveTab('pending'); // Switch to pending tab to see the new fight
    } catch (err) {
      console.error('Failed to create fight:', err);
      alert('Failed to create fight. Please try again.');
    } finally {
      setIsCreating(false);
    }
  };

  const tabs: { id: ArenaTab; label: string; count: number }[] = [
    { id: 'live', label: 'Live', count: liveFights.length },
    { id: 'pending', label: 'Pending', count: waitingFights.length },
    { id: 'finished', label: 'Finished', count: finishedFights.length },
    { id: 'my-fights', label: 'My Fights', count: myFights.length },
  ];

  // Show skeleton while initially loading
  if (isLoading && fights.length === 0) {
    return (
      <AppShell>
        <div className="container mx-auto px-4 md:px-6 py-6">
          {/* Header matches actual layout - title left, stats center, button right */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
            {/* Title - Left */}
            <div>
              <h2 className="font-display text-2xl font-bold text-white">Arena</h2>
              <p className="text-surface-400 text-sm">Challenge traders to 1v1 battles. Win weekly prizes.</p>
            </div>

            {/* Stats - Center */}
            <div className="flex items-center gap-4 md:gap-6">
              <div className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-surface-500 animate-pulse" />
                <span className="text-xs text-surface-500">...</span>
              </div>
              <div className="w-px h-4 bg-surface-700" />
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 bg-surface-500 rounded-full" />
                <span className="text-sm text-surface-400">- Live</span>
              </div>
              <span className="text-sm text-surface-400">- Pending</span>
              <span className="text-sm text-surface-400 hidden sm:block">- Fighters</span>
            </div>

            {/* Create Fight button - Right */}
            <div className="w-28 h-10 rounded-lg bg-surface-700 animate-pulse" />
          </div>
          <ArenaSkeleton />
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="container mx-auto px-4 md:px-6 py-6">
        {/* Compact Header with Stats */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <div>
            <h2 className="font-display text-2xl font-bold text-white">Arena</h2>
            <p className="text-surface-400 text-sm">
              Challenge traders to 1v1 battles. Win weekly prizes.
            </p>
          </div>

          {/* Inline Stats */}
          <div className="flex items-center gap-4 md:gap-6">
            {/* WebSocket Status */}
            <div className="flex items-center gap-1.5" title={wsConnected ? 'Real-time updates active' : 'Connecting...'}>
              <span className={`w-1.5 h-1.5 rounded-full ${wsConnected ? 'bg-win-400' : 'bg-surface-500 animate-pulse'}`} />
              <span className="text-xs text-surface-500">{wsConnected ? 'Live' : '...'}</span>
            </div>
            <div className="w-px h-4 bg-surface-700" />
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 bg-live-400 rounded-full animate-pulse" />
              <span className="text-sm text-surface-300">
                <span className="font-bold text-white">{stats.live}</span> Live
              </span>
            </div>
            <div className="text-sm text-surface-300">
              <span className="font-bold text-white">{stats.pending}</span> Pending
            </div>
            <div className="text-sm text-surface-300 hidden sm:block">
              <span className="font-bold text-white">{stats.fighters}</span> Fighters
            </div>
          </div>

          {/* Create Button - Always shows "Create Fight", opens wallet modal if not connected */}
          {connecting ? (
            <button disabled className="btn-primary opacity-50">
              Connecting...
            </button>
          ) : connected && isAuthenticating ? (
            <button disabled className="btn-primary opacity-50">
              Signing...
            </button>
          ) : connected && !isAuthenticated ? (
            <button disabled className="btn-primary opacity-50">
              Authenticating...
            </button>
          ) : (
            <button
              onClick={handleCreateClick}
              className="btn-primary"
            >
              + Create Fight
            </button>
          )}
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-6 p-4 bg-loss-500/20 border border-loss-500/30 rounded-lg text-loss-400 text-center">
            {error}
            <button
              onClick={() => fetchFights()}
              className="ml-4 underline hover:no-underline"
            >
              Retry
            </button>
          </div>
        )}

        {/* Tabs and Filters */}
        <div className="border-b border-surface-700 mb-6 overflow-x-auto">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 min-w-max sm:min-w-0">
            {/* Tabs */}
            <div className="flex gap-1 flex-shrink-0">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                    activeTab === tab.id
                      ? 'text-primary-400 border-primary-400'
                      : 'text-surface-400 border-transparent hover:text-white hover:border-surface-600'
                  }`}
                >
                  {tab.label}
                  {tab.count > 0 && (
                    <span className={`ml-2 px-1.5 py-0.5 text-xs rounded ${
                      activeTab === tab.id
                        ? 'bg-primary-500/20 text-primary-400'
                        : 'bg-surface-700 text-surface-400'
                    }`}>
                      {tab.count}
                    </span>
                  )}
                </button>
              ))}
            </div>

            {/* Filters */}
            <div className="flex items-center gap-2 pb-3 sm:pb-0">
              <span className="text-xs text-surface-500 mr-1">Filter:</span>

              {/* Status Filter - only show on My Fights tab */}
              {activeTab === 'my-fights' && (
                <select
                  value={filterStatus ?? ''}
                  onChange={(e) => setFilterStatus(e.target.value || null)}
                  className="bg-surface-800 border border-surface-700 rounded-lg px-2 py-1.5 text-xs text-surface-300 focus:outline-none focus:border-primary-500"
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
                className="bg-surface-800 border border-surface-700 rounded-lg px-2 py-1.5 text-xs text-surface-300 focus:outline-none focus:border-primary-500"
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
                className="bg-surface-800 border border-surface-700 rounded-lg px-2 py-1.5 text-xs text-surface-300 focus:outline-none focus:border-primary-500"
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
        </div>

        {/* Tab Content */}
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-20">
            <div className="spinner" />
            <p className="mt-4 text-surface-400">Loading fights...</p>
          </div>
        ) : displayFights.length === 0 ? (
          <div className="card text-center py-16">
            <p className="text-surface-400 text-lg mb-4">
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
                {activeTab === 'pending' && connected && isAuthenticated && (
                  <button
                    onClick={handleCreateClick}
                    className="text-primary-400 hover:text-primary-300 font-medium"
                  >
                    Create the first challenge →
                  </button>
                )}
                {activeTab === 'my-fights' && connected && isAuthenticated && (
                  <button
                    onClick={handleCreateClick}
                    className="text-primary-400 hover:text-primary-300 font-medium"
                  >
                    Start your first fight →
                  </button>
                )}
              </>
            )}
          </div>
        ) : (
          <div className="flex flex-col">
            {/* Fixed height container for 3 rows of cards (240px each + 16px gaps) */}
            <div className="min-h-[752px]">
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 content-start">
                {paginatedFights.map((fight) => (
                  <FightCard key={fight.id} fight={fight} onJoinFight={joinFight} onCancelFight={cancelFight} />
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

                  {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
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
                  ))}

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

            {/* Results info */}
            {displayFights.length > 0 && (
              <div className="text-center text-xs text-surface-500">
                Showing {(currentPage - 1) * ITEMS_PER_PAGE + 1}-{Math.min(currentPage * ITEMS_PER_PAGE, displayFights.length)} of {displayFights.length} fights
              </div>
            )}
          </div>
        )}
      {/* Create Fight Modal */}
      {showCreateModal && (
        <div className="modal-overlay" onClick={() => setShowCreateModal(false)}>
          <div className="modal-content p-6 max-w-md" onClick={(e) => e.stopPropagation()}>
            {/* Modal Header */}
            <div className="flex items-center justify-between mb-6">
              <h3 className="font-display text-xl font-bold uppercase tracking-wide">
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
                        : 'bg-surface-800 text-surface-400 hover:bg-surface-700 hover:text-white border border-surface-700'
                    }`}
                  >
                    {duration}m
                  </button>
                ))}
              </div>
            </div>

            {/* Max Trading Size Selection */}
            <div className="mb-6">
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
                        : 'bg-surface-800 text-surface-400 hover:bg-surface-700 hover:text-white border border-surface-700'
                    }`}
                  >
                    ${stake.toLocaleString()}
                  </button>
                ))}
              </div>
            </div>

            {/* Summary */}
            <div className="bg-surface-800 rounded-xl p-4 mb-5 border border-surface-700">
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
                  <>
                    <div className="spinner w-4 h-4 mr-2" />
                    Creating...
                  </>
                ) : (
                  'Create'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
      </div>
    </AppShell>
  );
}
