import { create } from 'zustand';
import type { AppRouterInstance } from 'next/dist/shared/lib/app-router-context.shared-runtime';

interface NavigationState {
  router: AppRouterInstance | null;
  setRouter: (router: AppRouterInstance) => void;
  navigate: (url: string) => void;
}

export const useNavigationStore = create<NavigationState>((set, get) => ({
  router: null,
  setRouter: (router) => set({ router }),
  navigate: (url) => {
    const { router } = get();
    if (router) {
      router.push(url);
    } else {
      console.warn('[NavigationStore] Router not set, using window.location');
      window.location.href = url;
    }
  },
}));
