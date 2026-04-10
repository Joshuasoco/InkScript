import { HANDWRITING_TEMPLATE_CONFIG } from '../constants';
import type { PreparedHandwritingUpload } from '../types';

const LOW_RESOLUTION_THRESHOLD = 1400;
const ASPECT_RATIO_WARNING_THRESHOLD = 0.18;

const createTemplateCanvas = (): HTMLCanvasElement => {
  const canvas = document.createElement('canvas');

  canvas.width = HANDWRITING_TEMPLATE_CONFIG.width;
  canvas.height = HANDWRITING_TEMPLATE_CONFIG.height;

  return canvas;
};

const buildWarning = (sourceWidth: number, sourceHeight: number): string | null => {
  const sourceAspectRatio = sourceWidth / sourceHeight;
  const templateAspectRatio =
    HANDWRITING_TEMPLATE_CONFIG.width / HANDWRITING_TEMPLATE_CONFIG.height;

  if (Math.abs(sourceAspectRatio - templateAspectRatio) > ASPECT_RATIO_WARNING_THRESHOLD) {
    return 'The photo ratio looks off. Try retaking it so the full printed page fills the frame.';
  }

  if (Math.max(sourceWidth, sourceHeight) < LOW_RESOLUTION_THRESHOLD) {
    return 'This photo is a little small. A sharper, brighter image will produce cleaner glyphs.';
  }

  return null;
};

export const prepareHandwritingUpload = async (
  file: File,
): Promise<PreparedHandwritingUpload> => {
  if (typeof createImageBitmap === 'undefined') {
    throw new Error('Image uploads require browser image decoding support.');
  }

  const bitmap = await createImageBitmap(file);
  const sourceWidth = bitmap.width;
  const sourceHeight = bitmap.height;
  const canvas = createTemplateCanvas();
  const context = canvas.getContext('2d');

  if (!context) {
    bitmap.close();
    throw new Error('Unable to prepare the uploaded image.');
  }

  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, canvas.width, canvas.height);

  const coverScale = Math.max(canvas.width / bitmap.width, canvas.height / bitmap.height);
  const drawWidth = bitmap.width * coverScale;
  const drawHeight = bitmap.height * coverScale;
  const drawX = (canvas.width - drawWidth) / 2;
  const drawY = (canvas.height - drawHeight) / 2;

  context.drawImage(bitmap, drawX, drawY, drawWidth, drawHeight);
  bitmap.close();

  const imageData = context.getImageData(0, 0, canvas.width, canvas.height);

  return {
    imageData,
    previewDataUrl: canvas.toDataURL('image/png'),
    sourceWidth,
    sourceHeight,
    warning: buildWarning(sourceWidth, sourceHeight),
  };
};
