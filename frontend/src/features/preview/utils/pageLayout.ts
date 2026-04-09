import type { PageSize } from '../../../types/handwriting';

export interface PreviewPageData {
  index: number;
  lines: string[];
}

export interface PreviewLayoutResult {
  pages: PreviewPageData[];
  lineCount: number;
  lineHeight: number;
  logicalPageWidth: number;
  logicalPageHeight: number;
}

const LOGICAL_PAGE_WIDTH = 900;
const PAGE_PADDING = 48;

const PAGE_ASPECT_RATIOS: Record<PageSize, number> = {
  A4: 297 / 210,
  Letter: 11 / 8.5,
  Square: 1,
};

export const getLogicalPageDimensions = (
  pageSize: PageSize,
): {
  width: number;
  height: number;
} => {
  const aspectRatio = PAGE_ASPECT_RATIOS[pageSize];

  return {
    width: LOGICAL_PAGE_WIDTH,
    height: Math.round(LOGICAL_PAGE_WIDTH * aspectRatio),
  };
};

const createMeasurementContext = (fontFamily: string, fontSize: number): CanvasRenderingContext2D => {
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');

  if (!context) {
    throw new Error('Unable to create a canvas context for layout measurement.');
  }

  context.font = `${fontSize}px ${fontFamily}`;

  return context;
};

const splitTokenToFitLine = (
  context: CanvasRenderingContext2D,
  token: string,
  maxWidth: number,
): string[] => {
  const segments: string[] = [];
  let currentSegment = '';

  for (const character of token) {
    const candidate = `${currentSegment}${character}`;

    if (currentSegment.length > 0 && context.measureText(candidate).width > maxWidth) {
      segments.push(currentSegment);
      currentSegment = character;
      continue;
    }

    currentSegment = candidate;
  }

  if (currentSegment.length > 0) {
    segments.push(currentSegment);
  }

  return segments;
};

const wrapTextToLines = (
  context: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
): string[] => {
  const paragraphs = text.replace(/\t/g, '    ').split('\n');
  const lines: string[] = [];

  for (const paragraph of paragraphs) {
    if (paragraph.length === 0) {
      lines.push('');
      continue;
    }

    const tokens = paragraph.split(/(\s+)/).filter((token) => token.length > 0);
    let currentLine = '';

    for (const token of tokens) {
      if (/^\s+$/.test(token) && currentLine.length === 0) {
        continue;
      }

      const candidate = `${currentLine}${token}`;

      if (context.measureText(candidate).width <= maxWidth) {
        currentLine = candidate;
        continue;
      }

      if (currentLine.trimEnd().length > 0) {
        lines.push(currentLine.trimEnd());
        currentLine = '';
      }

      if (/^\s+$/.test(token)) {
        continue;
      }

      if (context.measureText(token).width <= maxWidth) {
        currentLine = token;
        continue;
      }

      const segments = splitTokenToFitLine(context, token, maxWidth);

      for (const [segmentIndex, segment] of segments.entries()) {
        if (segmentIndex === segments.length - 1) {
          currentLine = segment;
        } else {
          lines.push(segment);
        }
      }
    }

    lines.push(currentLine.trimEnd());
  }

  return lines;
};

export const createPreviewLayout = ({
  text,
  fontFamily,
  fontSize,
  lineSpacing,
  pageSize,
}: {
  text: string;
  fontFamily: string;
  fontSize: number;
  lineSpacing: number;
  pageSize: PageSize;
}): PreviewLayoutResult => {
  const { width, height } = getLogicalPageDimensions(pageSize);
  const context = createMeasurementContext(fontFamily, fontSize);
  const lineHeight = fontSize * lineSpacing;
  const maxLineWidth = width - PAGE_PADDING * 2;
  const sourceText = text.trim().length > 0 ? text : 'Start typing to preview handwriting output.';
  const wrappedLines = wrapTextToLines(context, sourceText, maxLineWidth);
  const usableHeight = height - PAGE_PADDING * 2;
  const linesPerPage = Math.max(1, Math.floor(usableHeight / lineHeight));
  const pages: PreviewPageData[] = [];

  for (let index = 0; index < wrappedLines.length; index += linesPerPage) {
    pages.push({
      index: pages.length,
      lines: wrappedLines.slice(index, index + linesPerPage),
    });
  }

  if (pages.length === 0) {
    pages.push({
      index: 0,
      lines: [''],
    });
  }

  return {
    pages,
    lineCount: wrappedLines.length,
    lineHeight,
    logicalPageWidth: width,
    logicalPageHeight: height,
  };
};
