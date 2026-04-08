import type { RenderEstimateRequest, RenderEstimateResponse } from '../types/api.js';

const DEFAULT_PAGE_WIDTH = 760;

export const estimateRenderMetrics = (
  request: RenderEstimateRequest,
): RenderEstimateResponse => {
  const characterWidth = Math.max(6, request.fontSize * 0.55);
  const charactersPerLine = Math.max(20, Math.floor(DEFAULT_PAGE_WIDTH / characterWidth));

  const paragraphLines = request.text
    .split('\n')
    .map((paragraph) => paragraph.trim())
    .map((paragraph) => {
      if (paragraph.length === 0) {
        return 1;
      }

      return Math.ceil(paragraph.length / charactersPerLine);
    });

  const lineCount = paragraphLines.reduce((sum, value) => sum + value, 0);
  const lineHeight = request.fontSize * request.lineSpacing;
  const linesPerPage = Math.max(1, Math.floor(request.pageHeight / lineHeight));
  const estimatedPages = Math.ceil(lineCount / linesPerPage);
  const estimatedRenderMs = Math.round(18 + lineCount * 1.75 + estimatedPages * 14);

  return {
    lineCount,
    estimatedPages,
    estimatedRenderMs,
  };
};
