import { MY_HANDWRITING_FONT_FAMILY } from '@features/my-handwriting/constants';

export type PaperType = 'lined' | 'blank' | 'grid' | 'dotted';
export type PageSize = 'A4' | 'Letter' | 'Square';

export interface FontOption {
  label: string;
  family: string;
  description?: string;
  requiresSetup?: boolean;
}

export interface HandwritingSettings {
  fontFamily: string;
  inkColor: string;
  fontSize: number;
  lineSpacing: number;
  letterVariation: number;
  paperType: PaperType;
  pageSize: PageSize;
}

export const PAPER_TYPES: readonly PaperType[] = ['lined', 'blank', 'grid', 'dotted'];
export const PAGE_SIZES: readonly PageSize[] = ['A4', 'Letter', 'Square'];

export const HANDWRITING_FONTS: readonly FontOption[] = [
  { label: 'Caveat', family: 'Caveat, cursive' },
  { label: 'Patrick Hand', family: '"Patrick Hand", cursive' },
  { label: 'Kalam', family: '"Kalam", cursive' },
  { label: 'Gloria Hallelujah', family: '"Gloria Hallelujah", cursive' },
  {
    label: 'My Handwriting',
    family: MY_HANDWRITING_FONT_FAMILY,
    description: 'Generate a personal font from your own template sheet.',
    requiresSetup: true,
  },
];
