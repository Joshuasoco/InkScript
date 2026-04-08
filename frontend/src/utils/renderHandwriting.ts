import type { HandwritingSettings, PaperType } from '../types/handwriting';

const PAGE_PADDING = 48;

const drawPaperBackground = (
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
  paperType: PaperType,
): void => {
  context.fillStyle = '#faf8f4';
  context.fillRect(0, 0, width, height);

  if (paperType === 'blank') {
    return;
  }

  context.strokeStyle = 'rgba(153, 178, 200, 0.6)';
  context.lineWidth = 1;

  if (paperType === 'lined') {
    for (let y = PAGE_PADDING; y < height; y += 32) {
      context.beginPath();
      context.moveTo(PAGE_PADDING, y);
      context.lineTo(width - PAGE_PADDING, y);
      context.stroke();
    }

    return;
  }

  if (paperType === 'grid') {
    for (let y = PAGE_PADDING; y < height; y += 24) {
      context.beginPath();
      context.moveTo(PAGE_PADDING, y);
      context.lineTo(width - PAGE_PADDING, y);
      context.stroke();
    }

    for (let x = PAGE_PADDING; x < width; x += 24) {
      context.beginPath();
      context.moveTo(x, PAGE_PADDING);
      context.lineTo(x, height - PAGE_PADDING);
      context.stroke();
    }

    return;
  }

  for (let y = PAGE_PADDING; y < height; y += 22) {
    for (let x = PAGE_PADDING; x < width; x += 22) {
      context.beginPath();
      context.arc(x, y, 1.2, 0, Math.PI * 2);
      context.fillStyle = 'rgba(148, 163, 184, 0.45)';
      context.fill();
    }
  }
};

const buildWrappedLines = (
  context: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
): string[] => {
  const paragraphs = text.split('\n');
  const lines: string[] = [];

  for (const paragraph of paragraphs) {
    const words = paragraph.split(/\s+/).filter((word) => word.length > 0);

    if (words.length === 0) {
      lines.push('');
      continue;
    }

    let currentLine = '';

    for (const word of words) {
      const candidate = currentLine.length > 0 ? `${currentLine} ${word}` : word;
      const candidateWidth = context.measureText(candidate).width;

      if (candidateWidth <= maxWidth) {
        currentLine = candidate;
      } else {
        lines.push(currentLine);
        currentLine = word;
      }
    }

    lines.push(currentLine);
  }

  return lines;
};

export const renderHandwriting = (
  canvas: HTMLCanvasElement,
  text: string,
  settings: HandwritingSettings,
): void => {
  const pixelRatio = window.devicePixelRatio || 1;
  const cssWidth = canvas.clientWidth > 0 ? canvas.clientWidth : 900;
  const cssHeight = canvas.clientHeight > 0 ? canvas.clientHeight : 1200;

  canvas.width = Math.round(cssWidth * pixelRatio);
  canvas.height = Math.round(cssHeight * pixelRatio);

  const context = canvas.getContext('2d');

  if (!context) {
    return;
  }

  context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
  context.clearRect(0, 0, cssWidth, cssHeight);

  drawPaperBackground(context, cssWidth, cssHeight, settings.paperType);

  context.fillStyle = settings.inkColor;
  context.textBaseline = 'alphabetic';
  context.font = `${settings.fontSize}px ${settings.fontFamily}`;

  const sourceText = text.trim().length > 0 ? text : 'Start typing to preview handwriting output.';
  const lines = buildWrappedLines(context, sourceText, cssWidth - PAGE_PADDING * 2);

  const lineHeight = settings.fontSize * settings.lineSpacing;
  const variationScale = (settings.letterVariation / 100) * 1.8;

  lines.forEach((line, lineIndex) => {
    const y = PAGE_PADDING + (lineIndex + 1) * lineHeight;

    if (y > cssHeight - PAGE_PADDING) {
      return;
    }

    let x = PAGE_PADDING;

    for (const character of line) {
      const characterWidth = context.measureText(character).width;
      const yJitter = (Math.random() - 0.5) * variationScale;
      const rotation = (Math.random() - 0.5) * (variationScale * 0.01);

      context.save();
      context.translate(x + characterWidth / 2, y + yJitter);
      context.rotate(rotation);
      context.fillText(character, -characterWidth / 2, 0);
      context.restore();

      x += characterWidth;

      if (x > cssWidth - PAGE_PADDING) {
        break;
      }
    }
  });
};
