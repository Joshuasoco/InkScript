export const MY_HANDWRITING_FONT_NAME = 'MyHandwriting';
export const MY_HANDWRITING_FONT_FAMILY = '"MyHandwriting", cursive';
export const MY_HANDWRITING_FONT_FILENAME = 'my-handwriting.ttf';
export const MY_HANDWRITING_STORAGE_KEY = 'my-handwriting-font';

export const HANDWRITING_TEMPLATE_CONFIG = {
  width: 960,
  height: 1360,
  columns: 10,
  cellWidth: 72,
  cellHeight: 96,
  gutter: 16,
  marginLeft: 48,
  marginTop: 256,
  labelOffsetX: 6,
  labelOffsetY: 16,
  baselineOffsetY: 74,
  baselineInsetX: 5,
  cornerRadius: 12,
  printableInset: 40,
} as const;

export const HANDWRITING_CHARACTER_ORDER =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789.,!?'-()@#&%";

export const HANDWRITING_TEMPLATE_ROWS = Math.ceil(
  HANDWRITING_CHARACTER_ORDER.length / HANDWRITING_TEMPLATE_CONFIG.columns,
);

export const TEMPLATE_PAGE_INSTRUCTIONS = [
  '1. Print this sheet at 100% scale on clean A4 paper.',
  '2. Write one character inside each box using a dark pen or marker.',
  '3. Keep the strokes clear, avoid touching the borders, and fill every box you can.',
  '4. Take a straight photo with the full page visible and good lighting.',
] as const;

export const DEFAULT_PREVIEW_TEXT = `The quick brown fox jumps over the lazy dog.
Pack my box with five dozen liquor jugs.
1234567890 @#&%`;

export type HandwritingTemplateCell = {
  character: string;
  col: number;
  row: number;
  x: number;
  y: number;
  width: number;
  height: number;
};

export const getTemplateCell = (index: number): HandwritingTemplateCell | null => {
  const character = HANDWRITING_CHARACTER_ORDER[index];

  if (!character) {
    return null;
  }

  const { columns, cellWidth, cellHeight, gutter, marginLeft, marginTop } =
    HANDWRITING_TEMPLATE_CONFIG;
  const col = index % columns;
  const row = Math.floor(index / columns);
  const x = marginLeft + col * (cellWidth + gutter);
  const y = marginTop + row * (cellHeight + gutter);

  return {
    character,
    col,
    row,
    x,
    y,
    width: cellWidth,
    height: cellHeight,
  };
};

export const getTemplateCells = (): HandwritingTemplateCell[] =>
  Array.from({ length: HANDWRITING_CHARACTER_ORDER.length }, (_, index) => getTemplateCell(index)).filter(
    (cell): cell is HandwritingTemplateCell => cell !== null,
  );
