import { create } from 'zustand';

interface VideoState {
  isPlaying: boolean;
  startVideo: () => void;
  stopVideo: () => void;
}

export const useVideoStore = create<VideoState>((set) => ({
  isPlaying: false,
  startVideo: () => set({ isPlaying: true }),
  stopVideo: () => set({ isPlaying: false }),
}));
