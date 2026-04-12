import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { loadStoredMyHandwritingFontMock } = vi.hoisted(() => ({
  loadStoredMyHandwritingFontMock: vi.fn<() => Promise<ArrayBuffer | null>>(),
}));

vi.mock('@features/my-handwriting/services/fontStorage', () => ({
  loadFont: loadStoredMyHandwritingFontMock,
}));

class FakeFontFace {
  readonly family: string;
  readonly source: string;

  constructor(family: string, source: string) {
    this.family = family;
    this.source = source;
  }

  load = vi.fn(async () => this);
}

const createBuffer = (seed: number): ArrayBuffer => Uint8Array.from([seed, seed + 1, seed + 2]).buffer;

describe('fontLoader custom font handling', () => {
  beforeEach(() => {
    vi.resetModules();
    loadStoredMyHandwritingFontMock.mockReset();

    const fontSet = {
      add: vi.fn(),
      delete: vi.fn(() => true),
      check: vi.fn(() => false),
    } as unknown as FontFaceSet;

    let objectUrlCounter = 0;

    vi.stubGlobal('window', {});
    vi.stubGlobal('document', { fonts: fontSet } as Document);
    vi.stubGlobal('FontFace', FakeFontFace as unknown as typeof FontFace);
    vi.spyOn(URL, 'createObjectURL').mockImplementation(() => `blob:font-${objectUrlCounter += 1}`);
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);
  });

  afterEach(async () => {
    const { resetMyHandwritingFontState } = await import('./fontLoader');

    resetMyHandwritingFontState();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('reloads the latest saved custom font instead of keeping the first in-memory version', async () => {
    loadStoredMyHandwritingFontMock
      .mockResolvedValueOnce(createBuffer(1))
      .mockResolvedValueOnce(createBuffer(9));

    const { loadMyHandwritingFont } = await import('./fontLoader');
    const firstResult = await loadMyHandwritingFont();
    const secondResult = await loadMyHandwritingFont();
    const urlApi = globalThis.URL as unknown as {
      createObjectURL: ReturnType<typeof vi.fn>;
      revokeObjectURL: ReturnType<typeof vi.fn>;
    };

    expect(firstResult).toEqual({ success: true });
    expect(secondResult).toEqual({ success: true });
    expect(loadStoredMyHandwritingFontMock).toHaveBeenCalledTimes(2);
    expect(urlApi.createObjectURL).toHaveBeenCalledTimes(2);
    expect(urlApi.revokeObjectURL).toHaveBeenCalledTimes(1);
    expect(document.fonts.delete).toHaveBeenCalledTimes(1);
  });

  it('clears the in-memory custom font state when the saved font is removed', async () => {
    loadStoredMyHandwritingFontMock
      .mockResolvedValueOnce(createBuffer(4))
      .mockResolvedValueOnce(null);

    const { loadMyHandwritingFont, resetMyHandwritingFontState } = await import('./fontLoader');
    const initialResult = await loadMyHandwritingFont();

    resetMyHandwritingFontState();

    const nextResult = await loadMyHandwritingFont();
    const urlApi = globalThis.URL as unknown as {
      revokeObjectURL: ReturnType<typeof vi.fn>;
    };

    expect(initialResult).toEqual({ success: true });
    expect(nextResult).toEqual({
      success: false,
      error: 'No saved handwriting font was found yet. Generate one first.',
    });
    expect(urlApi.revokeObjectURL).toHaveBeenCalledTimes(1);
  });
});
