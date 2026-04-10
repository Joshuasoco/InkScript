import opentype, { Font as OpenTypeFont, Glyph as OpenTypeGlyph, Path as OpenTypePath } from 'opentype.js';

import {
  MY_HANDWRITING_FONT_FILENAME,
  MY_HANDWRITING_FONT_NAME,
} from '../constants';
import type { GeneratedHandwritingFont } from '../types';
import { parseSvgPathData } from '../utils/svgPathParser';

const UNITS_PER_EM = 1000;
const ASCENDER = 800;
const DESCENDER = -200;
const DEFAULT_ADVANCE_WIDTH = 620;
const SPACE_ADVANCE_WIDTH = 320;
const TARGET_LEFT_PADDING = 70;
const TARGET_BOTTOM_PADDING = -80;
const TARGET_DRAW_WIDTH = 540;
const TARGET_DRAW_HEIGHT = 840;

interface Bounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

type ParsedCommand = ReturnType<typeof parseSvgPathData>[number];

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

const transformX = (value: number, bounds: Bounds, scale: number, extraOffsetX: number): number =>
  TARGET_LEFT_PADDING + extraOffsetX + (value - bounds.minX) * scale;

const transformY = (value: number, bounds: Bounds, scale: number, extraOffsetY: number): number =>
  TARGET_BOTTOM_PADDING + extraOffsetY + (bounds.maxY - value) * scale;

const buildGlyphPath = (pathData: string): { path: OpenTypePath; advanceWidth: number } => {
  const commands = parseSvgPathData(pathData);
  const bounds = getBoundsFromCommands(commands);
  const path = new opentype.Path();

  if (!bounds) {
    return { path, advanceWidth: DEFAULT_ADVANCE_WIDTH };
  }

  const sourceWidth = Math.max(bounds.maxX - bounds.minX, 1);
  const sourceHeight = Math.max(bounds.maxY - bounds.minY, 1);
  const scale = Math.min(TARGET_DRAW_WIDTH / sourceWidth, TARGET_DRAW_HEIGHT / sourceHeight);
  const extraOffsetX = Math.max(0, (TARGET_DRAW_WIDTH - sourceWidth * scale) / 2);
  const extraOffsetY = Math.max(0, (TARGET_DRAW_HEIGHT - sourceHeight * scale) / 2);

  commands.forEach((command) => {
    switch (command.type) {
      case 'M':
        path.moveTo(
          transformX(command.x, bounds, scale, extraOffsetX),
          transformY(command.y, bounds, scale, extraOffsetY),
        );
        break;

      case 'L':
        path.lineTo(
          transformX(command.x, bounds, scale, extraOffsetX),
          transformY(command.y, bounds, scale, extraOffsetY),
        );
        break;

      case 'Q':
        path.quadraticCurveTo(
          transformX(command.x1, bounds, scale, extraOffsetX),
          transformY(command.y1, bounds, scale, extraOffsetY),
          transformX(command.x, bounds, scale, extraOffsetX),
          transformY(command.y, bounds, scale, extraOffsetY),
        );
        break;

      case 'C':
        path.curveTo(
          transformX(command.x1, bounds, scale, extraOffsetX),
          transformY(command.y1, bounds, scale, extraOffsetY),
          transformX(command.x2, bounds, scale, extraOffsetX),
          transformY(command.y2, bounds, scale, extraOffsetY),
          transformX(command.x, bounds, scale, extraOffsetX),
          transformY(command.y, bounds, scale, extraOffsetY),
        );
        break;

      case 'Z':
        path.close();
        break;
    }
  });

  const transformedWidth = sourceWidth * scale;
  const advanceWidth = Math.round(
    Math.min(UNITS_PER_EM * 0.9, TARGET_LEFT_PADDING * 2 + transformedWidth + 40),
  );

  return {
    path,
    advanceWidth: Math.max(advanceWidth, 240),
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
