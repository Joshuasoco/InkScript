import { create } from 'zustand';

import type { HandwritingSettings, PaperType } from '../../../types/handwriting';

interface SettingsState extends HandwritingSettings {
  setFontFamily: (value: string) => void;
  setInkColor: (value: string) => void;
  setFontSize: (value: number) => void;
  setLineSpacing: (value: number) => void;
  setLetterVariation: (value: number) => void;
  setPaperType: (value: PaperType) => void;
}

const DEFAULT_SETTINGS: HandwritingSettings = {
  fontFamily: 'Caveat, cursive',
  inkColor: '#1f2937',
  fontSize: 22,
  lineSpacing: 1.5,
  letterVariation: 36,
  paperType: 'lined',
};

export const useSettingsStore = create<SettingsState>((set) => ({
  ...DEFAULT_SETTINGS,
  setFontFamily: (value) => {
    set({ fontFamily: value });
  },
  setInkColor: (value) => {
    set({ inkColor: value });
  },
  setFontSize: (value) => {
    set({ fontSize: value });
  },
  setLineSpacing: (value) => {
    set({ lineSpacing: value });
  },
  setLetterVariation: (value) => {
    set({ letterVariation: value });
  },
  setPaperType: (value) => {
    set({ paperType: value });
  },
}));
