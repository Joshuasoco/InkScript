import { create } from 'zustand';

interface AppState {
  isSettingsOpen: boolean;
  toggleSettings: () => void;
}

export const useAppStore = create<AppState>((set) => ({
  isSettingsOpen: true,
  toggleSettings: () => {
    set((state) => ({ isSettingsOpen: !state.isSettingsOpen }));
  },
}));
