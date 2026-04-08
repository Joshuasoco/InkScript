export type PaperType = 'lined' | 'blank' | 'grid' | 'dotted';

export interface FontOption {
  label: string;
  family: string;
}

export interface HandwritingSettings {
  fontFamily: string;
  inkColor: string;
  fontSize: number;
  lineSpacing: number;
  letterVariation: number;
  paperType: PaperType;
}

export const PAPER_TYPES: readonly PaperType[] = ['lined', 'blank', 'grid', 'dotted'];

export const HANDWRITING_FONTS: readonly FontOption[] = [
  { label: 'Caveat', family: 'Caveat, cursive' },
  { label: 'Patrick Hand', family: '"Patrick Hand", cursive' },
  { label: 'Segoe Script', family: '"Segoe Script", cursive' }
];
