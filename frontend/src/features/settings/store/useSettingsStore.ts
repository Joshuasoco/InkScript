import { create } from 'zustand';

import type { FontOption, HandwritingSettings, PageSize, PaperType } from '../../../types/handwriting';

interface SettingsState extends HandwritingSettings {
  setFontFamily: (value: FontOption['family']) => void;
  setInkColor: (value: string) => void;
  setFontSize: (value: number) => void;
  setLineSpacing: (value: number) => void;
  setLetterVariation: (value: number) => void;
  setPaperType: (value: PaperType) => void;
  setPageSize: (value: PageSize) => void;
}

const clamp = (value: number, min: number, max: number): number => {
  if (Number.isNaN(value)) {
    return min;
  }

  if (value < min) {
    return min;
  }

  if (value > max) {
    return max;
  }

  return value;
};

const normalizeHexColor = (value: string): string | null => {
  const trimmed = value.trim();

  if (trimmed.length === 0) {
    return null;
  }

  const withHash = trimmed.startsWith('#') ? trimmed : `#${trimmed}`;

  if (!/^#[0-9a-fA-F]{6}$/.test(withHash)) {
    return null;
  }

  return withHash.toUpperCase();
};

const DEFAULT_SETTINGS: HandwritingSettings = {
  fontFamily: 'Caveat, cursive',
  inkColor: '#1f2937',
  fontSize: 22,
  lineSpacing: 1.5,
  letterVariation: 36,
  paperType: 'lined',
  pageSize: 'A4',
};

export const useSettingsStore = create<SettingsState>((set) => ({
  ...DEFAULT_SETTINGS,
  setFontFamily: (value) => {
    set({ fontFamily: value });
  },
  setInkColor: (value) => {
    set((state) => {
      const normalized = normalizeHexColor(value);

      return {
        inkColor: normalized ?? state.inkColor,
      };
    });
  },
  setFontSize: (value) => {
    set({ fontSize: Math.round(clamp(value, 12, 28)) });
  },
  setLineSpacing: (value) => {
    set({ lineSpacing: Math.round(clamp(value, 1, 2.5) * 10) / 10 });
  },
  setLetterVariation: (value) => {
    set({ letterVariation: Math.round(clamp(value, 0, 100)) });
  },
  setPaperType: (value) => {
    set({ paperType: value });
  },
  setPageSize: (value) => {
    set({ pageSize: value });
  },
}));
