import { buildFont } from '../services/fontBuilder';
import { sliceCharacters } from '../services/gridSlicer';
import { preprocessGlyph } from '../services/imagePreprocessor';
import { vectorizeAll } from '../services/vectorizer';
import type {
  HandwritingProcessingProgress,
  MyHandwritingWorkerMessage,
  MyHandwritingWorkerRequest,
} from '../types';

interface LocalWorkerScope {
  postMessage: (message: MyHandwritingWorkerMessage, transfer?: Transferable[]) => void;
  onmessage: ((event: MessageEvent<MyHandwritingWorkerRequest>) => void) | null;
}

const workerScope = self as unknown as LocalWorkerScope;

const postProgress = (progress: HandwritingProcessingProgress): void => {
  const message: MyHandwritingWorkerMessage = {
    type: 'progress',
    payload: progress,
  };

  workerScope.postMessage(message);
};

self.onmessage = async (event: MessageEvent<MyHandwritingWorkerRequest>): Promise<void> => {
  if (event.data.type !== 'generate-font') {
    return;
  }

  try {
    const { width, height, pixels } = event.data.payload;
    const imageData = new ImageData(new Uint8ClampedArray(pixels), width, height);
    const slicedGlyphs = sliceCharacters(imageData);

    postProgress({
      stage: 'slicing',
      completed: slicedGlyphs.size,
      total: slicedGlyphs.size,
      message: 'Slicing the uploaded template into character cells.',
    });

    const normalizedGlyphs = new Map<string, ImageData>();
    let processedGlyphs = 0;

    for (const [character, glyph] of slicedGlyphs) {
      const processed = preprocessGlyph(glyph);

      if (processed.hasInk) {
        normalizedGlyphs.set(character, processed.imageData);
      }

      processedGlyphs += 1;
      postProgress({
        stage: 'preprocessing',
        completed: processedGlyphs,
        total: slicedGlyphs.size,
        message: 'Cleaning up each character before tracing.',
      });
    }

    const tracedGlyphs = await vectorizeAll(normalizedGlyphs, (completed, total) => {
      postProgress({
        stage: 'vectorizing',
        completed,
        total,
        message: 'Tracing your handwriting into scalable outlines.',
      });
    });

    postProgress({
      stage: 'building',
      completed: 0,
      total: Math.max(tracedGlyphs.size, 1),
      message: 'Packing the traced outlines into a font file.',
    });

    const font = await buildFont(tracedGlyphs);

    postProgress({
      stage: 'building',
      completed: Math.max(tracedGlyphs.size, 1),
      total: Math.max(tracedGlyphs.size, 1),
      message: 'Font build complete.',
    });

    workerScope.postMessage(
      {
        type: 'success',
        payload: font,
      } satisfies MyHandwritingWorkerMessage,
      [font.buffer],
    );
  } catch (error) {
    workerScope.postMessage({
      type: 'error',
      payload: {
        message:
          error instanceof Error
            ? error.message
            : 'Something went wrong while generating the handwriting font.',
      },
    } satisfies MyHandwritingWorkerMessage);
  }
};
