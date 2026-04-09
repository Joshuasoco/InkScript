import { create } from 'zustand';

type MobileTab = 'edit' | 'preview';

interface AppState {
  activeMobileTab: MobileTab;
  isSettingsSheetOpen: boolean;
  isExportSheetOpen: boolean;
  setActiveMobileTab: (value: MobileTab) => void;
  openSettingsSheet: () => void;
  closeSettingsSheet: () => void;
  openExportSheet: () => void;
  closeExportSheet: () => void;
}

export const useAppStore = create<AppState>((set) => ({
  activeMobileTab: 'edit',
  isSettingsSheetOpen: false,
  isExportSheetOpen: false,
  setActiveMobileTab: (value) => {
    set({ activeMobileTab: value });
  },
  openSettingsSheet: () => {
    set({ isSettingsSheetOpen: true });
  },
  closeSettingsSheet: () => {
    set({ isSettingsSheetOpen: false });
  },
  openExportSheet: () => {
    set({ isExportSheetOpen: true });
  },
  closeExportSheet: () => {
    set({ isExportSheetOpen: false });
  },
}));
