import { describe, expect, it } from 'vitest';

import { HANDWRITING_TEMPLATE_CONFIG, getTemplateCells } from '../constants';

import { correctTemplatePerspective, measureTemplateMatch } from './uploadPreparation';

const createSyntheticImageData = (backgroundLuminance = 245): ImageData => {
  const data = new Uint8ClampedArray(
    HANDWRITING_TEMPLATE_CONFIG.width * HANDWRITING_TEMPLATE_CONFIG.height * 4,
  );

  for (let index = 0; index < data.length; index += 4) {
    data[index] = backgroundLuminance;
    data[index + 1] = backgroundLuminance;
    data[index + 2] = backgroundLuminance;
    data[index + 3] = 255;
  }

  return {
    width: HANDWRITING_TEMPLATE_CONFIG.width,
    height: HANDWRITING_TEMPLATE_CONFIG.height,
    data,
  } as unknown as ImageData;
};

const setGrayPixel = (imageData: ImageData, x: number, y: number, luminance: number): void => {
  if (x < 0 || y < 0 || x >= imageData.width || y >= imageData.height) {
    return;
  }

  const index = (Math.round(y) * imageData.width + Math.round(x)) * 4;

  imageData.data[index] = luminance;
  imageData.data[index + 1] = luminance;
  imageData.data[index + 2] = luminance;
  imageData.data[index + 3] = 255;
};

const drawShiftedCellBorders = (
  imageData: ImageData,
  xShift: number,
  yShift: number,
  luminance = 178,
): void => {
  getTemplateCells().forEach((cell) => {
    const left = Math.round(cell.x + xShift);
    const top = Math.round(cell.y + yShift);
    const right = Math.round(left + cell.width - 1);
    const bottom = Math.round(top + cell.height - 1);

    for (let x = left; x <= right; x += 1) {
      setGrayPixel(imageData, x, top, luminance);
      setGrayPixel(imageData, x, bottom, luminance);
    }

    for (let y = top; y <= bottom; y += 1) {
      setGrayPixel(imageData, left, y, luminance);
      setGrayPixel(imageData, right, y, luminance);
    }
  });
};

describe('measureTemplateMatch', () => {
  it('accepts a template whose borders drift a few pixels from the ideal grid', () => {
    const imageData = createSyntheticImageData();

    drawShiftedCellBorders(imageData, 4, 4);

    expect(measureTemplateMatch(imageData)).toBeGreaterThan(0.75);
  });

  it('rejects a blank page that does not contain the template grid', () => {
    const imageData = createSyntheticImageData();

    expect(measureTemplateMatch(imageData)).toBeLessThan(0.05);
  });

  it('does not regress template score when perspective correction runs on near-aligned input', () => {
    const imageData = createSyntheticImageData();

    drawShiftedCellBorders(imageData, 5, 3);

    const beforeScore = measureTemplateMatch(imageData);
    const corrected = correctTemplatePerspective(imageData);
    const afterScore = measureTemplateMatch(corrected);

    expect(afterScore).toBeGreaterThanOrEqual(beforeScore - 0.03);
  });
});
