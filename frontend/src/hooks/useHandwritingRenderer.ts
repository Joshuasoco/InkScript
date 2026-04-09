import { useEffect, useRef, useState } from 'react';
import type { MutableRefObject } from 'react';

import type { PaperType } from '../types/handwriting';

const DEFAULT_CANVAS_WIDTH = 900;
const DEFAULT_CANVAS_HEIGHT = 1200;
const PAGE_PADDING = 48;
const MAX_SIZE_JITTER = 2;
const MAX_ROTATION_DEGREES = 1.5;
const MAX_Y_OFFSET = 2;
const TARGET_CHARACTERS_PER_FRAME = 280;

export interface UseHandwritingRendererOptions {
  text: string;
  fontFamily: string;
  inkColor: string;
  fontSize: number;
  lineSpacing: number;
  letterVariation: number;
  paperType: PaperType;
  canvasRef?: MutableRefObject<HTMLCanvasElement | null>;
  seed?: number;
}

export interface UseHandwritingRendererResult {
  canvasRef: MutableRefObject<HTMLCanvasElement | null>;
  regenerate: () => void;
  isRendering: boolean;
}

interface LineLayout {
  text: string;
  y: number;
}

const clamp = (value: number, min: number, max: number): number => {
  if (value < min) {
    return min;
  }

  if (value > max) {
    return max;
  }

  return value;
};

const degreesToRadians = (value: number): number => (value * Math.PI) / 180;

const createSeededRandom = (seed: number): (() => number) => {
  let state = seed >>> 0;

  return () => {
    state += 0x6d2b79f5;

    let next = Math.imul(state ^ (state >>> 15), state | 1);
    next ^= next + Math.imul(next ^ (next >>> 7), next | 61);

    return ((next ^ (next >>> 14)) >>> 0) / 4294967296;
  };
};

const randomInRange = (random: () => number, min: number, max: number): number =>
  min + (max - min) * random();

const getCanvasSize = (canvas: HTMLCanvasElement): { width: number; height: number } => ({
  width: canvas.clientWidth > 0 ? canvas.clientWidth : DEFAULT_CANVAS_WIDTH,
  height: canvas.clientHeight > 0 ? canvas.clientHeight : DEFAULT_CANVAS_HEIGHT,
});

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

const buildWrappedLines = (
  context: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  lineHeight: number,
  canvasHeight: number,
): LineLayout[] => {
  const paragraphs = text.replace(/\t/g, '    ').split('\n');
  const lines: LineLayout[] = [];

  const pushLine = (value: string): void => {
    const y = PAGE_PADDING + (lines.length + 1) * lineHeight;

    if (y > canvasHeight - PAGE_PADDING) {
      return;
    }

    lines.push({ text: value, y });
  };

  for (const paragraph of paragraphs) {
    if (paragraph.length === 0) {
      pushLine('');
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
        pushLine(currentLine.trimEnd());
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
          pushLine(segment);
        }
      }
    }

    pushLine(currentLine.trimEnd());
  }

  return lines;
};

const drawLine = (
  context: CanvasRenderingContext2D,
  line: LineLayout,
  settings: Omit<UseHandwritingRendererOptions, 'text' | 'seed'>,
  random: () => number,
  maxX: number,
): void => {
  let x = PAGE_PADDING;
  const intensity = clamp(settings.letterVariation, 0, 1);

  for (const character of line.text) {
    const sizeOffset = randomInRange(random, -MAX_SIZE_JITTER, MAX_SIZE_JITTER) * intensity;
    const rotation = degreesToRadians(
      randomInRange(random, -MAX_ROTATION_DEGREES, MAX_ROTATION_DEGREES) * intensity,
    );
    const yOffset = randomInRange(random, -MAX_Y_OFFSET, MAX_Y_OFFSET) * intensity;

    const characterFontSize = Math.max(1, settings.fontSize + sizeOffset);
    context.font = `${characterFontSize}px ${settings.fontFamily}`;

    const characterWidth = context.measureText(character).width;
    const nextX = x + characterWidth;

    if (nextX > maxX) {
      break;
    }

    context.save();
    context.translate(x + characterWidth / 2, line.y + yOffset);
    context.rotate(rotation);
    context.fillText(character, -characterWidth / 2, 0);
    context.restore();

    x = nextX;
  }
};

export const useHandwritingRenderer = ({
  text,
  fontFamily,
  inkColor,
  fontSize,
  lineSpacing,
  letterVariation,
  paperType,
  canvasRef: providedCanvasRef,
  seed,
}: UseHandwritingRendererOptions): UseHandwritingRendererResult => {
  const internalCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const canvasRef = providedCanvasRef ?? internalCanvasRef;
  const animationFrameRef = useRef<number | null>(null);
  const renderSequenceRef = useRef(0);
  const [renderVersion, setRenderVersion] = useState(0);
  const [resizeVersion, setResizeVersion] = useState(0);
  const [isRendering, setIsRendering] = useState(false);

  const regenerate = (): void => {
    setRenderVersion((value) => value + 1);
  };

  useEffect(() => {
    const canvas = canvasRef.current;

    if (!canvas) {
      return;
    }

    const observer = new ResizeObserver(() => {
      setResizeVersion((value) => value + 1);
    });

    observer.observe(canvas);

    return () => {
      observer.disconnect();
    };
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;

    if (!canvas) {
      return;
    }

    if (animationFrameRef.current !== null) {
      window.cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }

    const context = canvas.getContext('2d');

    if (!context) {
      return;
    }

    const { width: cssWidth, height: cssHeight } = getCanvasSize(canvas);
    const pixelRatio = window.devicePixelRatio || 1;

    canvas.width = Math.round(cssWidth * pixelRatio);
    canvas.height = Math.round(cssHeight * pixelRatio);

    context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    context.clearRect(0, 0, cssWidth, cssHeight);

    drawPaperBackground(context, cssWidth, cssHeight, paperType);

    context.fillStyle = inkColor;
    context.textBaseline = 'alphabetic';
    context.font = `${fontSize}px ${fontFamily}`;

    const lineHeight = fontSize * lineSpacing;
    const lines = buildWrappedLines(
      context,
      text,
      cssWidth - PAGE_PADDING * 2,
      lineHeight,
      cssHeight,
    );

    if (lines.length === 0) {
      setIsRendering(false);
      return;
    }

    const renderId = renderSequenceRef.current + 1;
    renderSequenceRef.current = renderId;
    setIsRendering(true);

    const effectiveSeed =
      seed ?? ((Date.now() + renderVersion * 101 + resizeVersion * 37) ^ (fontSize << 8)) >>> 0;
    const random = createSeededRandom(effectiveSeed);
    const maxX = cssWidth - PAGE_PADDING;
    let nextLineIndex = 0;

    const finishRendering = (): void => {
      if (renderSequenceRef.current !== renderId) {
        return;
      }

      animationFrameRef.current = null;
      setIsRendering(false);
    };

    const renderFrame = (): void => {
      if (renderSequenceRef.current !== renderId) {
        return;
      }

      let remainingCharacters = TARGET_CHARACTERS_PER_FRAME;

      while (nextLineIndex < lines.length && remainingCharacters > 0) {
        const line = lines[nextLineIndex];

        if (!line) {
          finishRendering();
          return;
        }

        drawLine(
          context,
          line,
          {
            fontFamily,
            inkColor,
            fontSize,
            lineSpacing,
            letterVariation,
            paperType,
          },
          random,
          maxX,
        );

        remainingCharacters -= Math.max(line.text.length, 1);
        nextLineIndex += 1;
      }

      if (nextLineIndex >= lines.length) {
        finishRendering();
        return;
      }

      animationFrameRef.current = window.requestAnimationFrame(renderFrame);
    };

    animationFrameRef.current = window.requestAnimationFrame(renderFrame);

    return () => {
      renderSequenceRef.current += 1;

      if (animationFrameRef.current !== null) {
        window.cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
    };
  }, [
    fontFamily,
    fontSize,
    inkColor,
    letterVariation,
    lineSpacing,
    paperType,
    renderVersion,
    resizeVersion,
    seed,
    text,
  ]);

  return {
    canvasRef,
    regenerate,
    isRendering,
  };
};
