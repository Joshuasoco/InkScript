import { create } from 'zustand';

import { getTextStats } from '@utils/textStats';

interface EditorState {
  rawText: string;
  debouncedText: string;
  charCount: number;
  wordCount: number;
  refreshVersion: number;
  setRawText: (value: string) => void;
  setDebouncedText: (value: string) => void;
  triggerManualRefresh: () => void;
}

const INITIAL_TEXT = '';
const initialStats = getTextStats(INITIAL_TEXT);

export const useEditorState = create<EditorState>((set, get) => ({
  rawText: INITIAL_TEXT,
  debouncedText: INITIAL_TEXT,
  charCount: initialStats.charCount,
  wordCount: initialStats.wordCount,
  refreshVersion: 0,
  setRawText: (value) => {
    const stats = getTextStats(value);

    set({
      rawText: value,
      charCount: stats.charCount,
      wordCount: stats.wordCount,
    });
  },
  setDebouncedText: (value) => {
    set({ debouncedText: value });
  },
  triggerManualRefresh: () => {
    const { rawText } = get();

    set((state) => ({
      debouncedText: rawText,
      refreshVersion: state.refreshVersion + 1,
    }));
  },
}));
