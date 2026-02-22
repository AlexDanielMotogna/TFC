import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { PacificaFailReason } from './api';
import type { ExchangeType } from '@tfc/shared';

export interface User {
  id: string;
  handle: string;
  avatarUrl: string | null;
  role?: 'USER' | 'ADMIN';
}

interface AuthState {
  token: string | null;
  user: User | null;
  walletAddress: string | null; // Solana wallet used for initial auth (persisted)
  isAuthenticated: boolean;
  isAdmin: boolean;
  pacificaConnected: boolean;
  pacificaFailReason: PacificaFailReason;
  exchangeType: ExchangeType | null;
  _hasHydrated: boolean;

  // Live trading wallet state (NOT persisted — derived from wallet adapter)
  solanaWalletConnected: boolean;       // Is a Solana wallet currently connected?
  tradingWalletAddress: string | null;  // Address of the currently connected Solana wallet

  // EVM / Hyperliquid auth state
  evmWalletAddress: string | null;
  hyperliquidConnected: boolean;
  agentApproved: boolean;

  setAuth: (token: string, user: User, pacificaConnected: boolean, walletAddress: string, pacificaFailReason?: PacificaFailReason) => void;
  setPacificaConnected: (connected: boolean) => void;
  setExchangeType: (exchange: ExchangeType) => void;
  setSolanaWalletConnected: (connected: boolean) => void;
  setTradingWalletAddress: (address: string | null) => void;
  /** Disconnect trading wallet only — preserves JWT auth session */
  disconnectTradingWallet: () => void;
  setEvmWalletAddress: (address: string | null) => void;
  setHyperliquidStatus: (connected: boolean, approved: boolean) => void;
  /** Clear only Solana-side auth (preserves exchangeType + EVM state) */
  clearSolanaAuth: () => void;
  /** Clear only EVM-side auth (preserves exchangeType + Solana state) */
  clearEvmAuth: () => void;
  /** Full reset — clears everything (used for explicit logout) */
  clearAuth: () => void;
  setHasHydrated: (state: boolean) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      user: null,
      walletAddress: null,
      isAuthenticated: false,
      isAdmin: false,
      pacificaConnected: false,
      pacificaFailReason: null,
      exchangeType: null,
      _hasHydrated: false,

      // Live trading wallet state (ephemeral, not persisted)
      solanaWalletConnected: false,
      tradingWalletAddress: null,

      // EVM / Hyperliquid
      evmWalletAddress: null,
      hyperliquidConnected: false,
      agentApproved: false,

      setAuth: (token, user, pacificaConnected, walletAddress, pacificaFailReason = null) =>
        set({
          token,
          user,
          walletAddress,
          isAuthenticated: true,
          isAdmin: user.role === 'ADMIN',
          pacificaConnected,
          pacificaFailReason,
        }),

      setPacificaConnected: (connected) =>
        set({ pacificaConnected: connected, pacificaFailReason: connected ? null : undefined }),

      setExchangeType: (exchange) =>
        set({ exchangeType: exchange }),

      setSolanaWalletConnected: (connected) =>
        set({ solanaWalletConnected: connected }),

      setTradingWalletAddress: (address) =>
        set({ tradingWalletAddress: address }),

      disconnectTradingWallet: () =>
        set({
          solanaWalletConnected: false,
          tradingWalletAddress: null,
          pacificaConnected: false,
          pacificaFailReason: null,
        }),

      setEvmWalletAddress: (address) =>
        set({ evmWalletAddress: address }),

      setHyperliquidStatus: (connected, approved) =>
        set({ hyperliquidConnected: connected, agentApproved: approved }),

      clearSolanaAuth: () =>
        set({
          token: null,
          user: null,
          walletAddress: null,
          isAuthenticated: false,
          isAdmin: false,
          pacificaConnected: false,
          pacificaFailReason: null,
        }),

      clearEvmAuth: () =>
        set({
          evmWalletAddress: null,
          hyperliquidConnected: false,
          agentApproved: false,
        }),

      clearAuth: () =>
        set({
          token: null,
          user: null,
          walletAddress: null,
          isAuthenticated: false,
          isAdmin: false,
          pacificaConnected: false,
          pacificaFailReason: null,
          exchangeType: null,
          solanaWalletConnected: false,
          tradingWalletAddress: null,
          evmWalletAddress: null,
          hyperliquidConnected: false,
          agentApproved: false,
        }),

      setHasHydrated: (state) => set({ _hasHydrated: state }),
    }),
    {
      name: 'tfc-auth',
      partialize: (state) => ({
        token: state.token,
        user: state.user,
        walletAddress: state.walletAddress,
        isAuthenticated: state.isAuthenticated,
        isAdmin: state.isAdmin,
        pacificaConnected: state.pacificaConnected,
        pacificaFailReason: state.pacificaFailReason,
        exchangeType: state.exchangeType,
        evmWalletAddress: state.evmWalletAddress,
        hyperliquidConnected: state.hyperliquidConnected,
        agentApproved: state.agentApproved,
      }),
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true);
      },
    }
  )
);

// ─────────────────────────────────────────────────────────────
// Fight Store (for real-time updates)
// ─────────────────────────────────────────────────────────────

interface FightState {
  currentFight: {
    id: string;
    participantA: ParticipantScore | null;
    participantB: ParticipantScore | null;
    leader: string | null;
    timeRemaining: number;
  } | null;

  // Local PnL calculated from frontend positions (more accurate, real-time)
  localPnl: {
    myPnlUsdc: number;
    myPnlPercent: number;
    myMargin: number;
  } | null;

  setCurrentFight: (fight: FightState['currentFight']) => void;
  updateScores: (participantA: ParticipantScore, participantB: ParticipantScore) => void;
  updateLocalPnl: (pnlUsdc: number, margin: number) => void;
  clearCurrentFight: () => void;
}

interface ParticipantScore {
  userId: string;
  handle: string;
  pnlPercent: number;
  scoreUsdc: number;
  tradesCount: number;
}

export const useFightStore = create<FightState>()((set) => ({
  currentFight: null,
  localPnl: null,

  setCurrentFight: (fight) => set({ currentFight: fight }),

  updateScores: (participantA, participantB) =>
    set((state) => {
      if (!state.currentFight) return state;

      const leader =
        participantA.pnlPercent === participantB.pnlPercent
          ? null
          : participantA.pnlPercent > participantB.pnlPercent
            ? participantA.userId
            : participantB.userId;

      return {
        currentFight: {
          ...state.currentFight,
          participantA,
          participantB,
          leader,
        },
      };
    }),

  // Update local PnL from frontend positions (real-time, accurate)
  updateLocalPnl: (pnlUsdc, margin) =>
    set({
      localPnl: {
        myPnlUsdc: pnlUsdc,
        myPnlPercent: margin > 0 ? (pnlUsdc / margin) * 100 : 0,
        myMargin: margin,
      },
    }),

  clearCurrentFight: () => set({ currentFight: null, localPnl: null }),
}));

// ─────────────────────────────────────────────────────────────
// App Store (general state)
// ─────────────────────────────────────────────────────────────

import type { Fight } from './api';

interface AppState {
  fights: Fight[];
  isLoading: boolean;
  error: string | null;

  setFights: (fights: Fight[]) => void;
  addFight: (fight: Fight) => void;
  updateFight: (fight: Fight) => void;
  removeFight: (fightId: string) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
}

export const useStore = create<AppState>()((set) => ({
  fights: [],
  isLoading: false,
  error: null,

  setFights: (fights) => set({ fights }),

  addFight: (fight) => set((state) => ({
    fights: [fight, ...state.fights.filter(f => f.id !== fight.id)]
  })),

  updateFight: (fight) => set((state) => ({
    fights: state.fights.map(f => f.id === fight.id ? fight : f)
  })),

  removeFight: (fightId) => set((state) => ({
    fights: state.fights.filter(f => f.id !== fightId)
  })),

  setLoading: (isLoading) => set({ isLoading }),
  setError: (error) => set({ error }),
}));
