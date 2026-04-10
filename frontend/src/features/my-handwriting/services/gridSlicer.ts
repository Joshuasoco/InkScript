import {
  HANDWRITING_CHARACTER_ORDER,
  HANDWRITING_TEMPLATE_CONFIG,
} from '../constants';

export const sliceCharacters = (pageImageData: ImageData): Map<string, ImageData> => {
  const sourceCanvas = new OffscreenCanvas(pageImageData.width, pageImageData.height);
  const sourceContext = sourceCanvas.getContext('2d');

  if (!sourceContext) {
    throw new Error('Unable to access the upload image data.');
  }

  sourceContext.putImageData(pageImageData, 0, 0);

  const slices = new Map<string, ImageData>();
  const { columns, cellWidth, cellHeight, gutter, marginLeft, marginTop } =
    HANDWRITING_TEMPLATE_CONFIG;

  Array.from(HANDWRITING_CHARACTER_ORDER).forEach((character, index) => {
    const col = index % columns;
    const row = Math.floor(index / columns);
    const x = marginLeft + col * (cellWidth + gutter);
    const y = marginTop + row * (cellHeight + gutter);

    slices.set(character, sourceContext.getImageData(x, y, cellWidth, cellHeight));
  });

  return slices;
};
