import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { PacificaFailReason } from './api';

export interface User {
  id: string;
  handle: string;
  avatarUrl: string | null;
  role?: 'USER' | 'ADMIN';
}

interface AuthState {
  token: string | null;
  user: User | null;
  walletAddress: string | null; // Store wallet address to detect account changes
  isAuthenticated: boolean;
  isAdmin: boolean;
  pacificaConnected: boolean;
  pacificaFailReason: PacificaFailReason;
  _hasHydrated: boolean;

  setAuth: (token: string, user: User, pacificaConnected: boolean, walletAddress: string, pacificaFailReason?: PacificaFailReason) => void;
  setPacificaConnected: (connected: boolean) => void;
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
      _hasHydrated: false,

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

      clearAuth: () =>
        set({
          token: null,
          user: null,
          walletAddress: null,
          isAuthenticated: false,
          isAdmin: false,
          pacificaConnected: false,
          pacificaFailReason: null,
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
