import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { MutableRefObject } from 'react';

import { getLogicalPageDimensions } from '@features/preview/utils/pageLayout';
import type { PageSize, PaperType } from '../types/handwriting';
import HandwritingWorker from '../workers/handwritingWorker?worker';

const PAGE_PADDING = 48;
const TARGET_CHARACTERS_PER_FRAME = 280;

interface RandomizedCharacter {
  sizeOffset: number;
  rotation: number;
  yOffset: number;
}

interface RandomizedLine {
  characters: RandomizedCharacter[];
}

interface WorkerResponse {
  type: 'randomized';
  payload: {
    lines: RandomizedLine[];
  };
}

export interface UseHandwritingRendererOptions {
  lines: string[];
  fontFamily: string;
  inkColor: string;
  fontSize: number;
  lineSpacing: number;
  letterVariation: number;
  paperType: PaperType;
  pageSize: PageSize;
  pageIndex: number;
  canvasRef?: MutableRefObject<HTMLCanvasElement | null>;
  seed?: number;
}

export interface UseHandwritingRendererResult {
  canvasRef: MutableRefObject<HTMLCanvasElement | null>;
  regenerate: () => void;
  isRendering: boolean;
}

const degreesToRadians = (value: number): number => (value * Math.PI) / 180;

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

const drawLine = (
  context: CanvasRenderingContext2D,
  line: string,
  randomizedLine: RandomizedLine | undefined,
  lineIndex: number,
  settings: {
    fontFamily: string;
    fontSize: number;
    lineSpacing: number;
  },
  maxX: number,
): void => {
  let x = PAGE_PADDING;
  const y = PAGE_PADDING + (lineIndex + 1) * settings.fontSize * settings.lineSpacing;

  for (const [characterIndex, character] of Array.from(line).entries()) {
    const transform = randomizedLine?.characters[characterIndex] ?? {
      sizeOffset: 0,
      rotation: 0,
      yOffset: 0,
    };
    const characterFontSize = Math.max(1, settings.fontSize + transform.sizeOffset);

    context.font = `${characterFontSize}px ${settings.fontFamily}`;

    const characterWidth = context.measureText(character).width;
    const nextX = x + characterWidth;

    if (nextX > maxX) {
      break;
    }

    context.save();
    context.translate(x + characterWidth / 2, y + transform.yOffset);
    context.rotate(degreesToRadians(transform.rotation));
    context.fillText(character, -characterWidth / 2, 0);
    context.restore();

    x = nextX;
  }
};

export const useHandwritingRenderer = ({
  lines,
  fontFamily,
  inkColor,
  fontSize,
  lineSpacing,
  letterVariation,
  paperType,
  pageSize,
  pageIndex,
  canvasRef: providedCanvasRef,
  seed,
}: UseHandwritingRendererOptions): UseHandwritingRendererResult => {
  const internalCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const canvasRef = providedCanvasRef ?? internalCanvasRef;
  const animationFrameRef = useRef<number | null>(null);
  const renderSequenceRef = useRef(0);
  const workerRef = useRef<Worker | null>(null);
  const [renderVersion, setRenderVersion] = useState(0);
  const [isRendering, setIsRendering] = useState(false);

  // WHY: The canvas size is memoized from page settings so redraws happen only when the paper shape changes.
  const logicalPageSize = useMemo(() => getLogicalPageDimensions(pageSize), [pageSize]);

  // WHY: Memoizing render settings prevents every parent re-render from invalidating the expensive draw effect.
  const renderSettings = useMemo(
    () => ({
      fontFamily,
      inkColor,
      fontSize,
      lineSpacing,
      letterVariation,
      paperType,
    }),
    [fontFamily, inkColor, fontSize, lineSpacing, letterVariation, paperType],
  );

  // WHY: The manual refresh handler stays referentially stable so memoized preview pages do not redraw unnecessarily.
  const regenerate = useCallback((): void => {
    setRenderVersion((value) => value + 1);
  }, []);

  useEffect(() => {
    // WHY: Reusing one worker per preview page avoids worker startup churn while keeping jitter math off the UI thread.
    workerRef.current = new HandwritingWorker();

    return () => {
      workerRef.current?.terminate();
      workerRef.current = null;
    };
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    const worker = workerRef.current;

    if (!canvas || !worker) {
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

    const pixelRatio = window.devicePixelRatio || 1;

    canvas.width = Math.round(logicalPageSize.width * pixelRatio);
    canvas.height = Math.round(logicalPageSize.height * pixelRatio);

    context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    context.clearRect(0, 0, logicalPageSize.width, logicalPageSize.height);

    drawPaperBackground(context, logicalPageSize.width, logicalPageSize.height, renderSettings.paperType);
    context.fillStyle = renderSettings.inkColor;
    context.textBaseline = 'alphabetic';

    if (lines.length === 0) {
      setIsRendering(false);
      return;
    }

    const renderId = renderSequenceRef.current + 1;
    renderSequenceRef.current = renderId;
    setIsRendering(true);

    const effectiveSeed =
      seed ??
      ((Date.now() + renderVersion * 101 + pageIndex * 3571) ^ (renderSettings.fontSize << 8)) >>> 0;
    const maxX = logicalPageSize.width - PAGE_PADDING;

    const handleWorkerMessage = (event: MessageEvent<WorkerResponse>): void => {
      if (renderSequenceRef.current !== renderId || event.data.type !== 'randomized') {
        return;
      }

      const randomizedLines = event.data.payload.lines;
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

        // WHY: Chunking canvas writes across animation frames keeps long pages from blocking keystrokes and scroll input.
        let remainingCharacters = TARGET_CHARACTERS_PER_FRAME;

        while (nextLineIndex < lines.length && remainingCharacters > 0) {
          const line = lines[nextLineIndex];

          if (line === undefined) {
            finishRendering();
            return;
          }

          drawLine(
            context,
            line,
            randomizedLines[nextLineIndex],
            nextLineIndex,
            {
              fontFamily: renderSettings.fontFamily,
              fontSize: renderSettings.fontSize,
              lineSpacing: renderSettings.lineSpacing,
            },
            maxX,
          );

          remainingCharacters -= Math.max(line.length, 1);
          nextLineIndex += 1;
        }

        if (nextLineIndex >= lines.length) {
          finishRendering();
          return;
        }

        animationFrameRef.current = window.requestAnimationFrame(renderFrame);
      };

      animationFrameRef.current = window.requestAnimationFrame(renderFrame);
    };

    worker.addEventListener('message', handleWorkerMessage as EventListener);
    worker.postMessage({
      type: 'randomize',
      payload: {
        lines,
        fontSize: renderSettings.fontSize,
        letterVariation: renderSettings.letterVariation,
        seed: effectiveSeed,
      },
    });

    return () => {
      renderSequenceRef.current += 1;
      worker.removeEventListener('message', handleWorkerMessage as EventListener);

      if (animationFrameRef.current !== null) {
        window.cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
    };
  }, [canvasRef, lines, logicalPageSize, pageIndex, renderSettings, renderVersion, seed]);

  return {
    canvasRef,
    regenerate,
    isRendering,
  };
};
