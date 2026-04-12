import {
  MY_HANDWRITING_FONT_FAMILY,
  MY_HANDWRITING_FONT_NAME,
} from '@features/my-handwriting/constants';
import { loadFont as loadStoredMyHandwritingFont } from '@features/my-handwriting/services/fontStorage';

export type HandwritingFontStyle = 'cursive' | 'print' | 'mixed';

export type SupportedScript = 'latin' | 'latin-ext' | 'arabic' | 'cyrillic' | 'devanagari';

export interface HandwritingFontDefinition {
  name: string;
  family: string;
  url: string;
  style: HandwritingFontStyle;
  languages: SupportedScript[];
}

export type FontLoaderErrorCode =
  | 'FONT_API_UNAVAILABLE'
  | 'FONT_NOT_FOUND'
  | 'FONT_SOURCE_FETCH_FAILED'
  | 'FONT_CSS_PARSE_FAILED'
  | 'FONT_FACE_LOAD_FAILED'
  | 'FONT_PRELOAD_FAILED';

export class FontLoaderError extends Error {
  readonly code: Exclude<FontLoaderErrorCode, 'FONT_PRELOAD_FAILED'>;
  readonly fontFamily: string;
  override readonly cause?: unknown;

  constructor(
    code: Exclude<FontLoaderErrorCode, 'FONT_PRELOAD_FAILED'>,
    fontFamily: string,
    message: string,
    options?: { cause?: unknown },
  ) {
    super(message);
    this.name = 'FontLoaderError';
    this.code = code;
    this.fontFamily = fontFamily;
    this.cause = options?.cause;
  }
}

export class FontPreloadError extends Error {
  readonly code = 'FONT_PRELOAD_FAILED' as const;
  readonly failures: FontLoaderError[];

  constructor(failures: FontLoaderError[]) {
    super(`Failed to preload ${failures.length} font${failures.length === 1 ? '' : 's'}.`);
    this.name = 'FontPreloadError';
    this.failures = failures;
  }
}

interface ParsedFontFaceRule {
  family: string;
  source: string;
  descriptors: FontFaceDescriptors;
}

const CSS_FONT_FACE_RULE_PATTERN = /@font-face\s*{([\s\S]*?)}/g;
const CSS_DECLARATION_PATTERN = /([\w-]+)\s*:\s*([^;]+);/g;
const SOURCE_URL_PATTERN = /url\((['"]?)([^'")]+)\1\)\s*(format\((['"][^)]+['"]|[^)])+\))?/;

const loadedFontFamilies = new Set<string>();
const pendingFontLoads = new Map<string, Promise<void>>();
let customFontObjectUrl: string | null = null;
let loadedMyHandwritingFace: FontFace | null = null;

const stripQuotes = (value: string): string => value.trim().replace(/^['"]|['"]$/g, '');

const normalizeFontIdentifier = (value: string): string =>
  stripQuotes(value)
    .split(',')[0]
    ?.trim()
    .replace(/\s+/g, ' ')
    .toLowerCase() ?? '';

const buildGoogleFontsCssUrl = (familyName: string, axes: string): string =>
  `https://fonts.googleapis.com/css2?family=${familyName.replace(/\s+/g, '+')}${axes}&display=swap`;

export const AVAILABLE_HANDWRITING_FONTS: readonly HandwritingFontDefinition[] = [
  {
    name: 'Caveat',
    family: '"Caveat", cursive',
    url: buildGoogleFontsCssUrl('Caveat', ':wght@400;500;600;700'),
    style: 'cursive',
    languages: ['latin', 'cyrillic'],
  },
  {
    name: 'Patrick Hand',
    family: '"Patrick Hand", cursive',
    url: buildGoogleFontsCssUrl('Patrick Hand', ''),
    style: 'print',
    languages: ['latin'],
  },
  {
    name: 'Kalam',
    family: '"Kalam", cursive',
    url: buildGoogleFontsCssUrl('Kalam', ':wght@300;400;700'),
    style: 'mixed',
    languages: ['latin', 'devanagari'],
  },
  {
    name: 'Gloria Hallelujah',
    family: '"Gloria Hallelujah", cursive',
    url: buildGoogleFontsCssUrl('Gloria Hallelujah', ''),
    style: 'print',
    languages: ['latin'],
  },
  {
    name: 'Shadows Into Light',
    family: '"Shadows Into Light", cursive',
    url: buildGoogleFontsCssUrl('Shadows Into Light', ''),
    style: 'cursive',
    languages: ['latin'],
  },
  {
    name: 'Reenie Beanie',
    family: '"Reenie Beanie", cursive',
    url: buildGoogleFontsCssUrl('Reenie Beanie', ''),
    style: 'cursive',
    languages: ['latin'],
  },
  {
    name: 'Sue Ellen Francisco',
    family: '"Sue Ellen Francisco", cursive',
    url: buildGoogleFontsCssUrl('Sue Ellen Francisco', ''),
    style: 'print',
    languages: ['latin'],
  },
  {
    name: 'Nothing You Could Do',
    family: '"Nothing You Could Do", cursive',
    url: buildGoogleFontsCssUrl('Nothing You Could Do', ''),
    style: 'mixed',
    languages: ['latin'],
  },
  {
    name: 'Aref Ruqaa Ink',
    family: '"Aref Ruqaa Ink", serif',
    url: buildGoogleFontsCssUrl('Aref Ruqaa Ink', ':wght@400;700'),
    style: 'mixed',
    languages: ['arabic', 'latin', 'latin-ext'],
  },
] as const;

const isMyHandwritingFont = (fontFamily: string): boolean => {
  const normalizedTarget = normalizeFontIdentifier(fontFamily);

  return [MY_HANDWRITING_FONT_NAME, MY_HANDWRITING_FONT_FAMILY].some(
    (candidate) => normalizeFontIdentifier(candidate) === normalizedTarget,
  );
};

const findFontDefinition = (fontFamily: string): HandwritingFontDefinition | undefined => {
  const normalizedTarget = normalizeFontIdentifier(fontFamily);

  return AVAILABLE_HANDWRITING_FONTS.find((font) => {
    const candidates = [font.name, font.family];

    return candidates.some((candidate) => normalizeFontIdentifier(candidate) === normalizedTarget);
  });
};

const ensureFontApiSupport = (fontFamily: string): void => {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    throw new FontLoaderError(
      'FONT_API_UNAVAILABLE',
      fontFamily,
      'Font loading is only available in a browser environment.',
    );
  }

  if (typeof FontFace === 'undefined' || !('fonts' in document)) {
    throw new FontLoaderError(
      'FONT_API_UNAVAILABLE',
      fontFamily,
      'The FontFace API is not available in this browser.',
    );
  }
};

const readCssDeclarationBlock = (block: string): Map<string, string> => {
  const declarations = new Map<string, string>();

  for (const match of block.matchAll(CSS_DECLARATION_PATTERN)) {
    const property = match[1]?.trim().toLowerCase();
    const value = match[2]?.trim();

    if (!property || !value) {
      continue;
    }

    declarations.set(property, value);
  }

  return declarations;
};

const buildFontFaceSource = (sourceDeclaration: string): string | null => {
  const match = sourceDeclaration.match(SOURCE_URL_PATTERN);

  if (!match) {
    return null;
  }

  const url = match[2];
  const format = match[3];

  if (!url) {
    return null;
  }

  return format ? `url("${url}") ${format}` : `url("${url}")`;
};

const parseFontFaceRules = (cssText: string, fontFamily: string): ParsedFontFaceRule[] => {
  const rules: ParsedFontFaceRule[] = [];
  const normalizedTarget = normalizeFontIdentifier(fontFamily);

  for (const match of cssText.matchAll(CSS_FONT_FACE_RULE_PATTERN)) {
    const declarationBlock = match[1];

    if (!declarationBlock) {
      continue;
    }

    const declarations = readCssDeclarationBlock(declarationBlock);
    const declaredFamily = declarations.get('font-family');

    if (!declaredFamily || normalizeFontIdentifier(declaredFamily) !== normalizedTarget) {
      continue;
    }

    const sourceDeclaration = declarations.get('src');
    const source = sourceDeclaration ? buildFontFaceSource(sourceDeclaration) : null;

    if (!source) {
      continue;
    }

    const descriptors: FontFaceDescriptors = {};
    const style = declarations.get('font-style');
    const weight = declarations.get('font-weight');
    const stretch = declarations.get('font-stretch');
    const unicodeRange = declarations.get('unicode-range');

    if (style) {
      descriptors.style = style;
    }

    if (weight) {
      descriptors.weight = weight;
    }

    if (stretch) {
      descriptors.stretch = stretch;
    }

    if (unicodeRange) {
      descriptors.unicodeRange = unicodeRange;
    }

    rules.push({
      family: stripQuotes(declaredFamily),
      source,
      descriptors,
    });
  }

  return rules;
};

const fetchFontCss = async (font: HandwritingFontDefinition): Promise<string> => {
  let response: Response;

  try {
    response = await fetch(font.url, {
      headers: {
        Accept: 'text/css,*/*;q=0.1',
      },
    });
  } catch (error) {
    throw new FontLoaderError(
      'FONT_SOURCE_FETCH_FAILED',
      font.family,
      `Unable to fetch the font stylesheet for ${font.name}.`,
      { cause: error },
    );
  }

  if (!response.ok) {
    throw new FontLoaderError(
      'FONT_SOURCE_FETCH_FAILED',
      font.family,
      `The font stylesheet request for ${font.name} failed with status ${response.status}.`,
    );
  }

  return response.text();
};

const loadFontFaces = async (font: HandwritingFontDefinition): Promise<void> => {
  const cssText = await fetchFontCss(font);
  const rules = parseFontFaceRules(cssText, font.family);

  if (rules.length === 0) {
    throw new FontLoaderError(
      'FONT_CSS_PARSE_FAILED',
      font.family,
      `No @font-face rules were found for ${font.name}.`,
    );
  }

  const loadedFaces = await Promise.all(
    rules.map(async (rule) => {
      try {
        const fontFace = new FontFace(rule.family, rule.source, rule.descriptors);
        const loadedFace = await fontFace.load();
        document.fonts.add(loadedFace);
      } catch (error) {
        throw new FontLoaderError(
          'FONT_FACE_LOAD_FAILED',
          font.family,
          `The font face for ${font.name} could not be loaded.`,
          { cause: error },
        );
      }
    }),
  );

  if (loadedFaces.length > 0) {
    loadedFontFamilies.add(normalizeFontIdentifier(font.family));
  }
};

export const isFontLoaderError = (error: unknown): error is FontLoaderError =>
  error instanceof FontLoaderError;

export const isFontPreloadError = (error: unknown): error is FontPreloadError =>
  error instanceof FontPreloadError;

export const resetMyHandwritingFontState = (): void => {
  const normalizedName = normalizeFontIdentifier(MY_HANDWRITING_FONT_NAME);
  const normalizedFamily = normalizeFontIdentifier(MY_HANDWRITING_FONT_FAMILY);

  loadedFontFamilies.delete(normalizedName);
  loadedFontFamilies.delete(normalizedFamily);

  if (
    loadedMyHandwritingFace &&
    typeof document !== 'undefined' &&
    'fonts' in document &&
    typeof document.fonts.delete === 'function'
  ) {
    document.fonts.delete(loadedMyHandwritingFace);
  }

  loadedMyHandwritingFace = null;

  if (customFontObjectUrl && typeof URL !== 'undefined') {
    URL.revokeObjectURL(customFontObjectUrl);
  }

  customFontObjectUrl = null;
};

export const loadMyHandwritingFont = async (): Promise<{ success: boolean; error?: string }> => {
  try {
    ensureFontApiSupport(MY_HANDWRITING_FONT_FAMILY);

    const buffer = await loadStoredMyHandwritingFont();

    if (!buffer) {
      resetMyHandwritingFontState();

      return {
        success: false,
        error: 'No saved handwriting font was found yet. Generate one first.',
      };
    }

    resetMyHandwritingFontState();

    customFontObjectUrl = URL.createObjectURL(new Blob([buffer], { type: 'font/ttf' }));

    const fontFace = new FontFace(MY_HANDWRITING_FONT_NAME, `url("${customFontObjectUrl}")`);
    const loadedFont = await fontFace.load();

    document.fonts.add(loadedFont);
    loadedMyHandwritingFace = loadedFont;
    loadedFontFamilies.add(normalizeFontIdentifier(MY_HANDWRITING_FONT_NAME));
    loadedFontFamilies.add(normalizeFontIdentifier(MY_HANDWRITING_FONT_FAMILY));

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : 'The saved handwriting font could not be loaded.',
    };
  }
};

export const loadFont = async (fontFamily: string): Promise<void> => {
  ensureFontApiSupport(fontFamily);

  if (isMyHandwritingFont(fontFamily)) {
    const result = await loadMyHandwritingFont();

    if (!result.success) {
      throw new FontLoaderError(
        'FONT_FACE_LOAD_FAILED',
        fontFamily,
        result.error ?? 'The saved handwriting font could not be loaded.',
      );
    }

    return;
  }

  const font = findFontDefinition(fontFamily);

  if (!font) {
    throw new FontLoaderError(
      'FONT_NOT_FOUND',
      fontFamily,
      `No registered handwriting font matches "${fontFamily}".`,
    );
  }

  const normalizedFamily = normalizeFontIdentifier(font.family);

  if (
    loadedFontFamilies.has(normalizedFamily) ||
    document.fonts.check(`16px ${font.family}`)
  ) {
    loadedFontFamilies.add(normalizedFamily);
    return;
  }

  const pendingLoad = pendingFontLoads.get(normalizedFamily);

  if (pendingLoad) {
    return pendingLoad;
  }

  const loadPromise = loadFontFaces(font).finally(() => {
    pendingFontLoads.delete(normalizedFamily);
  });

  pendingFontLoads.set(normalizedFamily, loadPromise);

  return loadPromise;
};

export const preloadFonts = async (families: string[]): Promise<void> => {
  const results = await Promise.allSettled(families.map((family) => loadFont(family)));
  const failures: FontLoaderError[] = [];

  for (const result of results) {
    if (result.status === 'fulfilled') {
      continue;
    }

    if (isFontLoaderError(result.reason)) {
      failures.push(result.reason);
      continue;
    }

    failures.push(
      new FontLoaderError(
        'FONT_FACE_LOAD_FAILED',
        'unknown',
        'An unexpected error occurred while preloading fonts.',
        { cause: result.reason },
      ),
    );
  }

  if (failures.length > 0) {
    throw new FontPreloadError(failures);
  }
};
