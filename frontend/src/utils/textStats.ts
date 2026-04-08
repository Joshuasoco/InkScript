export interface TextStats {
  charCount: number;
  wordCount: number;
}

export const getTextStats = (value: string): TextStats => {
  const trimmed = value.trim();

  return {
    charCount: value.length,
    wordCount: trimmed.length > 0 ? trimmed.split(/\s+/).length : 0,
  };
};
