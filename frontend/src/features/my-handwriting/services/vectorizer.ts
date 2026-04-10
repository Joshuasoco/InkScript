const extractPathData = (svgMarkup: string): string => {
  const matches = Array.from(svgMarkup.matchAll(/<path[^>]*d="([^"]+)"/g), (match) => match[1]);

  return matches.join(' ').trim();
};

const getPotraceLoader = (() => {
  let pendingModule:
    | Promise<{
        loadFromCanvas: (canvas: OffscreenCanvas | HTMLCanvasElement) => Promise<string>;
      }>
    | null = null;

  return async () => {
    if (!pendingModule) {
      pendingModule = import('potrace-wasm').then((module) => {
        const loadFromCanvas = module.loadFromCanvas ?? module.default?.loadFromCanvas;

        if (!loadFromCanvas) {
          throw new Error('potrace-wasm did not expose loadFromCanvas().');
        }

        return { loadFromCanvas };
      });
    }

    return pendingModule;
  };
})();

export const vectorizeGlyph = async (imageData: ImageData): Promise<string> => {
  const canvas = new OffscreenCanvas(imageData.width, imageData.height);
  const context = canvas.getContext('2d');

  if (!context) {
    throw new Error('Unable to create a tracing canvas.');
  }

  context.putImageData(imageData, 0, 0);

  const { loadFromCanvas } = await getPotraceLoader();
  const svgMarkup = await loadFromCanvas(canvas);
  const pathData = extractPathData(svgMarkup);

  if (pathData.length === 0) {
    throw new Error('Potrace returned an empty path.');
  }

  return pathData;
};

export const vectorizeAll = async (
  glyphs: Map<string, ImageData>,
  onProgress?: (completed: number, total: number) => void,
): Promise<Map<string, string>> => {
  const paths = new Map<string, string>();
  let completed = 0;
  const total = glyphs.size;

  for (const [character, imageData] of glyphs) {
    try {
      const path = await vectorizeGlyph(imageData);

      if (path.length > 0) {
        paths.set(character, path);
      }
    } catch {
      // WHY: One malformed cell should not throw away the rest of the generated alphabet.
    } finally {
      completed += 1;
      onProgress?.(completed, total);
    }
  }

  return paths;
};
