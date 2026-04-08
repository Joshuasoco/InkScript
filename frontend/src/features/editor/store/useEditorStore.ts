import { create } from 'zustand';

import { getTextStats } from '@utils/textStats';

interface EditorState {
  rawText: string;
  debouncedText: string;
  charCount: number;
  wordCount: number;
  setRawText: (value: string) => void;
  setDebouncedText: (value: string) => void;
}

const INITIAL_TEXT =
  'Dear Professor,\n\nPlease find my draft attached. I used the handwriting preview to verify spacing before submission.';

const initialStats = getTextStats(INITIAL_TEXT);

export const useEditorStore = create<EditorState>((set) => ({
  rawText: INITIAL_TEXT,
  debouncedText: INITIAL_TEXT,
  charCount: initialStats.charCount,
  wordCount: initialStats.wordCount,
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
}));
