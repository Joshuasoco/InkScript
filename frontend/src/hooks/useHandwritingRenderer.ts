import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { MutableRefObject } from 'react';

import { getLogicalPageDimensions } from '@features/preview/utils/pageLayout';
import type { PageSize, PaperType } from '../types/handwriting';
import HandwritingWorker from '../workers/handwritingWorker?worker';

const PAGE_PADDING = 48;
const TARGET_CHARACTERS_PER_FRAME = 280;
const WORD_REVEAL_DURATION_MS = 180;
const WORD_REVEAL_STAGGER_MS = 75;

interface RandomizedCharacter {
  sizeOffset: number;
  rotation: number;
  yOffset: number;
}

interface RandomizedLine {
  characters: RandomizedCharacter[];
}

interface AnimatedWordRange {
  startIndex: number;
  endIndex: number;
  delayMs: number;
}

interface LineAnimationPlan {
  staticUntilIndex: number;
  words: Array<Omit<AnimatedWordRange, 'delayMs'>>;
}

interface LineCharacterMetric {
  index: number;
  character: string;
  x: number;
  width: number;
  fontSize: number;
  rotation: number;
  yOffset: number;
}

interface LineDrawPlan {
  y: number;
  characters: LineCharacterMetric[];
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

const clamp = (value: number, min: number, max: number): number => {
  if (value < min) {
    return min;
  }

  if (value > max) {
    return max;
  }

  return value;
};

const isWhitespace = (character: string | undefined): boolean =>
  character !== undefined && /\s/.test(character);

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

const getLineDrawPlan = (
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
): LineDrawPlan => {
  let x = PAGE_PADDING;
  const y = PAGE_PADDING + (lineIndex + 1) * settings.fontSize * settings.lineSpacing;
  const characters: LineCharacterMetric[] = [];

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

    characters.push({
      index: characterIndex,
      character,
      x,
      width: characterWidth,
      fontSize: characterFontSize,
      rotation: transform.rotation,
      yOffset: transform.yOffset,
    });

    x = nextX;
  }

  return {
    y,
    characters,
  };
};

const drawLineCharacters = (
  context: CanvasRenderingContext2D,
  linePlan: LineDrawPlan,
  settings: {
    fontFamily: string;
  },
  startIndex = 0,
  endIndex = Number.POSITIVE_INFINITY,
): void => {
  for (const metric of linePlan.characters) {
    if (metric.index < startIndex || metric.index >= endIndex) {
      continue;
    }

    context.font = `${metric.fontSize}px ${settings.fontFamily}`;
    context.save();
    context.translate(metric.x + metric.width / 2, linePlan.y + metric.yOffset);
    context.rotate(degreesToRadians(metric.rotation));
    context.fillText(metric.character, -metric.width / 2, 0);
    context.restore();
  }
};

const createLineAnimationPlan = (
  previousLine: string | undefined,
  nextLine: string,
): LineAnimationPlan | null => {
  if (previousLine === nextLine) {
    return null;
  }

  const previousCharacters = Array.from(previousLine ?? '');
  const nextCharacters = Array.from(nextLine);
  let sharedPrefixLength = 0;

  while (
    sharedPrefixLength < previousCharacters.length &&
    sharedPrefixLength < nextCharacters.length &&
    previousCharacters[sharedPrefixLength] === nextCharacters[sharedPrefixLength]
  ) {
    sharedPrefixLength += 1;
  }

  let animationStartIndex = Math.min(sharedPrefixLength, nextCharacters.length);

  while (animationStartIndex > 0 && !isWhitespace(nextCharacters[animationStartIndex - 1])) {
    animationStartIndex -= 1;
  }

  const words: Array<Omit<AnimatedWordRange, 'delayMs'>> = [];
  let currentIndex = animationStartIndex;

  while (currentIndex < nextCharacters.length) {
    while (currentIndex < nextCharacters.length && isWhitespace(nextCharacters[currentIndex])) {
      currentIndex += 1;
    }

    const wordStart = currentIndex;

    while (currentIndex < nextCharacters.length && !isWhitespace(nextCharacters[currentIndex])) {
      currentIndex += 1;
    }

    if (wordStart < currentIndex) {
      words.push({
        startIndex: wordStart,
        endIndex: currentIndex,
      });
    }
  }

  if (words.length === 0) {
    return null;
  }

  return {
    staticUntilIndex: animationStartIndex,
    words,
  };
};

const drawAnimatedWord = (
  context: CanvasRenderingContext2D,
  linePlan: LineDrawPlan,
  settings: {
    fontFamily: string;
    fontSize: number;
  },
  word: AnimatedWordRange,
  progress: number,
): void => {
  const visibleCharacters = linePlan.characters.filter(
    (metric) => metric.index >= word.startIndex && metric.index < word.endIndex,
  );

  if (visibleCharacters.length === 0) {
    return;
  }

  const firstCharacter = visibleCharacters[0];
  const lastCharacter = visibleCharacters[visibleCharacters.length - 1];

  if (!firstCharacter || !lastCharacter) {
    return;
  }

  const left = firstCharacter.x;
  const right = lastCharacter.x + lastCharacter.width;
  const revealWidth = Math.max(0, (right - left) * progress);

  context.save();
  context.globalAlpha = 0.35 + progress * 0.65;
  context.beginPath();
  context.rect(left - 1, linePlan.y - settings.fontSize * 1.2, revealWidth + 2, settings.fontSize * 1.8);
  context.clip();
  drawLineCharacters(context, linePlan, settings, word.startIndex, word.endIndex);
  context.restore();
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
  const previousLinesRef = useRef<string[]>([]);
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
    const previousLines = previousLinesRef.current;
    previousLinesRef.current = lines;

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
      let nextAnimatedWordDelay = 0;
      const animatedLineEntries: Array<{
        linePlan: LineDrawPlan;
        words: AnimatedWordRange[];
      }> = [];

      const finishRendering = (): void => {
        if (renderSequenceRef.current !== renderId) {
          return;
        }

        animationFrameRef.current = null;
        setIsRendering(false);
      };

      const animateChangedWords = (startTimestamp: number): void => {
        const animationStep = (timestamp: number): void => {
          if (renderSequenceRef.current !== renderId) {
            return;
          }

          let hasPendingAnimations = false;
          const elapsed = timestamp - startTimestamp;

          for (const entry of animatedLineEntries) {
            for (const word of entry.words) {
              const progress = clamp((elapsed - word.delayMs) / WORD_REVEAL_DURATION_MS, 0, 1);

              if (progress <= 0) {
                hasPendingAnimations = true;
                continue;
              }

              drawAnimatedWord(
                context,
                entry.linePlan,
                {
                  fontFamily: renderSettings.fontFamily,
                  fontSize: renderSettings.fontSize,
                },
                word,
                progress,
              );

              if (progress < 1) {
                hasPendingAnimations = true;
              }
            }
          }

          if (!hasPendingAnimations) {
            finishRendering();
            return;
          }

          animationFrameRef.current = window.requestAnimationFrame(animationStep);
        };

        animationFrameRef.current = window.requestAnimationFrame(animationStep);
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

          const linePlan = getLineDrawPlan(
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
          const lineAnimation = createLineAnimationPlan(previousLines[nextLineIndex], line);

          if (!lineAnimation) {
            drawLineCharacters(context, linePlan, {
              fontFamily: renderSettings.fontFamily,
            });
          } else {
            // WHY: Comparing against the previously rendered lines lets us animate only new words instead of replaying the whole page on every keystroke.
            drawLineCharacters(
              context,
              linePlan,
              {
                fontFamily: renderSettings.fontFamily,
              },
              0,
              lineAnimation.staticUntilIndex,
            );

            const visibleAnimatedWords = lineAnimation.words
              .map((word, wordIndex) => ({
                ...word,
                delayMs: nextAnimatedWordDelay + wordIndex * WORD_REVEAL_STAGGER_MS,
              }))
              .filter((word) =>
                linePlan.characters.some(
                  (metric) => metric.index >= word.startIndex && metric.index < word.endIndex,
                ),
              );

            if (visibleAnimatedWords.length > 0) {
              animatedLineEntries.push({
                linePlan,
                words: visibleAnimatedWords,
              });
              nextAnimatedWordDelay += visibleAnimatedWords.length * WORD_REVEAL_STAGGER_MS;
            } else {
              drawLineCharacters(context, linePlan, {
                fontFamily: renderSettings.fontFamily,
              });
            }
          }

          remainingCharacters -= Math.max(line.length, 1);
          nextLineIndex += 1;
        }

        if (nextLineIndex >= lines.length) {
          if (animatedLineEntries.length === 0) {
            finishRendering();
            return;
          }

          animationFrameRef.current = window.requestAnimationFrame((timestamp) => {
            animateChangedWords(timestamp);
          });
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
