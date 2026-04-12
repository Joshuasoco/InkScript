import opentype, { Font as OpenTypeFont, Glyph as OpenTypeGlyph, Path as OpenTypePath } from 'opentype.js';

import {
  HANDWRITING_TEMPLATE_CONFIG,
  MY_HANDWRITING_FONT_FILENAME,
  MY_HANDWRITING_FONT_NAME,
} from '../constants';
import type { GeneratedHandwritingFont } from '../types';
import { parseSvgPathData } from '../utils/svgPathParser';

const UNITS_PER_EM = 1000;
const SOURCE_TO_FONT_SCALE = 10;
const ASCENDER = 780;
const DESCENDER = -220;
const DEFAULT_ADVANCE_WIDTH = 620;
const SPACE_ADVANCE_WIDTH = 320;
const TARGET_LEFT_PADDING = 40;
const TARGET_RIGHT_PADDING = 60;
const MIN_ADVANCE_WIDTH = 220;
const MAX_PATH_COMMANDS = 1400;
const MAX_SOURCE_GLYPH_WIDTH = HANDWRITING_TEMPLATE_CONFIG.cellWidth * 1.5;
const MAX_SOURCE_GLYPH_HEIGHT = HANDWRITING_TEMPLATE_CONFIG.cellHeight * 1.5;

interface Bounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

type ParsedCommand = ReturnType<typeof parseSvgPathData>[number];

const GUIDE_LINE_MAX_HEIGHT = 14;
const GUIDE_LINE_MIN_WIDTH = HANDWRITING_TEMPLATE_CONFIG.cellWidth * 0.6;
const GUIDE_LINE_MIN_Y = HANDWRITING_TEMPLATE_CONFIG.baselineOffsetY - 24;
const GUIDE_LINE_MAX_Y = HANDWRITING_TEMPLATE_CONFIG.baselineOffsetY + 28;
const GUIDE_BORDER_MAX_WIDTH = 10;
const GUIDE_BORDER_MIN_HEIGHT = HANDWRITING_TEMPLATE_CONFIG.cellHeight * 0.65;
const GUIDE_BORDER_EDGE_MARGIN = 12;

const createNotdefGlyph = (): OpenTypeGlyph =>
  new opentype.Glyph({
    name: '.notdef',
    unicode: 0,
    advanceWidth: DEFAULT_ADVANCE_WIDTH,
    path: new opentype.Path(),
  });

const createSpaceGlyph = (): OpenTypeGlyph =>
  new opentype.Glyph({
    name: 'space',
    unicode: 32,
    advanceWidth: SPACE_ADVANCE_WIDTH,
    path: new opentype.Path(),
  });

const getBoundsFromCommands = (commands: ParsedCommand[]): Bounds | null => {
  const xs: number[] = [];
  const ys: number[] = [];

  commands.forEach((command) => {
    if ('x' in command) {
      xs.push(command.x);
    }

    if ('y' in command) {
      ys.push(command.y);
    }

    if ('x1' in command) {
      xs.push(command.x1);
    }

    if ('y1' in command) {
      ys.push(command.y1);
    }

    if ('x2' in command) {
      xs.push(command.x2);
    }

    if ('y2' in command) {
      ys.push(command.y2);
    }
  });

  if (xs.length === 0 || ys.length === 0) {
    return null;
  }

  return {
    minX: Math.min(...xs),
    minY: Math.min(...ys),
    maxX: Math.max(...xs),
    maxY: Math.max(...ys),
  };
};

const splitCommandContours = (commands: ParsedCommand[]): ParsedCommand[][] => {
  const contours: ParsedCommand[][] = [];
  let current: ParsedCommand[] = [];

  commands.forEach((command) => {
    if (command.type === 'M' && current.length > 0) {
      contours.push(current);
      current = [];
    }

    current.push(command);
  });

  if (current.length > 0) {
    contours.push(current);
  }

  return contours;
};

const shouldDiscardGuideContour = (bounds: Bounds): boolean => {
  const width = bounds.maxX - bounds.minX + 1;
  const height = bounds.maxY - bounds.minY + 1;
  const midpointX = (bounds.minX + bounds.maxX) / 2;
  const midpointY = (bounds.minY + bounds.maxY) / 2;

  if (
    width >= GUIDE_LINE_MIN_WIDTH &&
    height <= GUIDE_LINE_MAX_HEIGHT &&
    midpointY >= GUIDE_LINE_MIN_Y &&
    midpointY <= GUIDE_LINE_MAX_Y
  ) {
    return true;
  }

  if (
    height >= GUIDE_BORDER_MIN_HEIGHT &&
    width <= GUIDE_BORDER_MAX_WIDTH &&
    (midpointX <= GUIDE_BORDER_EDGE_MARGIN ||
      midpointX >= HANDWRITING_TEMPLATE_CONFIG.cellWidth - GUIDE_BORDER_EDGE_MARGIN)
  ) {
    return true;
  }

  return false;
};

const stripGuideContours = (commands: ParsedCommand[]): ParsedCommand[] => {
  const filteredContours = splitCommandContours(commands).filter((contour) => {
    const bounds = getBoundsFromCommands(contour);

    if (!bounds) {
      return false;
    }

    return !shouldDiscardGuideContour(bounds);
  });

  const filteredCommands = filteredContours.flat();

  return filteredCommands.length > 0 ? filteredCommands : commands;
};

const commandHasNonFiniteValue = (command: ParsedCommand): boolean => {
  const numericValues: number[] = [];

  if ('x' in command) {
    numericValues.push(command.x);
  }

  if ('y' in command) {
    numericValues.push(command.y);
  }

  if ('x1' in command) {
    numericValues.push(command.x1);
  }

  if ('y1' in command) {
    numericValues.push(command.y1);
  }

  if ('x2' in command) {
    numericValues.push(command.x2);
  }

  if ('y2' in command) {
    numericValues.push(command.y2);
  }

  return numericValues.some((value) => !Number.isFinite(value));
};

const transformX = (value: number, bounds: Bounds): number =>
  TARGET_LEFT_PADDING + (value - bounds.minX) * SOURCE_TO_FONT_SCALE;

const transformY = (value: number): number =>
  HANDWRITING_TEMPLATE_CONFIG.baselineOffsetY * SOURCE_TO_FONT_SCALE - value * SOURCE_TO_FONT_SCALE;

const buildGlyphPath = (pathData: string): { path: OpenTypePath; advanceWidth: number } => {
  const commands = stripGuideContours(parseSvgPathData(pathData));

  if (commands.length === 0 || commands.length > MAX_PATH_COMMANDS) {
    throw new Error('Skipping malformed glyph outline.');
  }

  if (commands.some(commandHasNonFiniteValue)) {
    throw new Error('Skipping non-finite glyph outline values.');
  }

  const bounds = getBoundsFromCommands(commands);
  const path = new opentype.Path();

  if (!bounds) {
    return { path, advanceWidth: DEFAULT_ADVANCE_WIDTH };
  }

  const sourceWidth = bounds.maxX - bounds.minX + 1;
  const sourceHeight = bounds.maxY - bounds.minY + 1;

  if (sourceWidth > MAX_SOURCE_GLYPH_WIDTH || sourceHeight > MAX_SOURCE_GLYPH_HEIGHT) {
    throw new Error('Skipping outlier glyph bounds.');
  }

  commands.forEach((command) => {
    switch (command.type) {
      case 'M':
        path.moveTo(transformX(command.x, bounds), transformY(command.y));
        break;

      case 'L':
        path.lineTo(transformX(command.x, bounds), transformY(command.y));
        break;

      case 'Q':
        path.quadraticCurveTo(
          transformX(command.x1, bounds),
          transformY(command.y1),
          transformX(command.x, bounds),
          transformY(command.y),
        );
        break;

      case 'C':
        path.curveTo(
          transformX(command.x1, bounds),
          transformY(command.y1),
          transformX(command.x2, bounds),
          transformY(command.y2),
          transformX(command.x, bounds),
          transformY(command.y),
        );
        break;

      case 'Z':
        path.close();
        break;
    }
  });

  const advanceWidth = Math.round(
    Math.min(
      UNITS_PER_EM * 0.92,
      TARGET_LEFT_PADDING + sourceWidth * SOURCE_TO_FONT_SCALE + TARGET_RIGHT_PADDING,
    ),
  );

  return {
    path,
    advanceWidth: Math.max(advanceWidth, MIN_ADVANCE_WIDTH),
  };
};

export const buildFont = async (
  paths: Map<string, string>,
): Promise<GeneratedHandwritingFont> => {
  const glyphs: OpenTypeGlyph[] = [createNotdefGlyph(), createSpaceGlyph()];
  const skippedCharacters: string[] = [];

  for (const [character, pathData] of paths) {
    if (pathData.trim().length === 0) {
      skippedCharacters.push(character);
      continue;
    }

    try {
      const { path, advanceWidth } = buildGlyphPath(pathData);

      glyphs.push(
        new opentype.Glyph({
          name: `char_${character.codePointAt(0)?.toString(16) ?? character}`,
          unicode: character.codePointAt(0),
          advanceWidth,
          path,
        }),
      );
    } catch {
      skippedCharacters.push(character);
    }
  }

  const font = new OpenTypeFont({
    familyName: MY_HANDWRITING_FONT_NAME,
    styleName: 'Regular',
    unitsPerEm: UNITS_PER_EM,
    ascender: ASCENDER,
    descender: DESCENDER,
    glyphs,
  });

  return {
    buffer: font.toArrayBuffer(),
    filename: MY_HANDWRITING_FONT_FILENAME,
    glyphCount: Math.max(glyphs.length - 2, 0),
    skippedCharacters,
  };
};

export const downloadGeneratedFont = (buffer: ArrayBuffer, filename: string): void => {
  const blob = new Blob([buffer], { type: 'font/ttf' });
  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement('a');

  anchor.href = objectUrl;
  anchor.download = filename;
  anchor.rel = 'noopener';
  anchor.style.display = 'none';

  document.body.append(anchor);
  anchor.click();
  anchor.remove();

  window.setTimeout(() => {
    URL.revokeObjectURL(objectUrl);
  }, 0);
};
