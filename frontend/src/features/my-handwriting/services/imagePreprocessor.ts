const OUTPUT_WIDTH = 72;
const OUTPUT_HEIGHT = 96;
const PADDING = 8;
const WHITE_PIXEL = 255;
const BLACK_PIXEL = 0;

export interface ProcessedGlyph {
  imageData: ImageData;
  hasInk: boolean;
}

const clamp = (value: number, min: number, max: number): number => {
  if (value < min) {
    return min;
  }

  if (value > max) {
    return max;
  }

  return value;
};

const createBlankGlyph = (): ImageData => {
  const data = new Uint8ClampedArray(OUTPUT_WIDTH * OUTPUT_HEIGHT * 4);

  for (let index = 0; index < data.length; index += 4) {
    data[index] = WHITE_PIXEL;
    data[index + 1] = WHITE_PIXEL;
    data[index + 2] = WHITE_PIXEL;
    data[index + 3] = WHITE_PIXEL;
  }

  return new ImageData(data, OUTPUT_WIDTH, OUTPUT_HEIGHT);
};

const toGrayscale = (imageData: ImageData): Uint8ClampedArray => {
  const grayscale = new Uint8ClampedArray(imageData.width * imageData.height);

  for (
    let sourceIndex = 0, grayIndex = 0;
    sourceIndex < imageData.data.length;
    sourceIndex += 4, grayIndex += 1
  ) {
    const red = imageData.data[sourceIndex] ?? WHITE_PIXEL;
    const green = imageData.data[sourceIndex + 1] ?? WHITE_PIXEL;
    const blue = imageData.data[sourceIndex + 2] ?? WHITE_PIXEL;

    grayscale[grayIndex] = Math.round(
      red * 0.299 +
        green * 0.587 +
        blue * 0.114,
    );
  }

  return grayscale;
};

const otsuThreshold = (grayscale: Uint8ClampedArray): number => {
  const histogram = new Array<number>(256).fill(0);

  for (const value of grayscale) {
    histogram[value] = (histogram[value] ?? 0) + 1;
  }

  const total = grayscale.length;
  let sum = 0;

  histogram.forEach((count, value) => {
    sum += value * count;
  });

  let sumBackground = 0;
  let weightBackground = 0;
  let maxVariance = 0;
  let threshold = 0;

  histogram.forEach((count, value) => {
    weightBackground += count;

    if (weightBackground === 0) {
      return;
    }

    const weightForeground = total - weightBackground;

    if (weightForeground === 0) {
      return;
    }

    sumBackground += value * count;

    const meanBackground = sumBackground / weightBackground;
    const meanForeground = (sum - sumBackground) / weightForeground;
    const variance = weightBackground * weightForeground * (meanBackground - meanForeground) ** 2;

    if (variance > maxVariance) {
      maxVariance = variance;
      threshold = value;
    }
  });

  return threshold;
};

const findInkBounds = (
  grayscale: Uint8ClampedArray,
  width: number,
  height: number,
  threshold: number,
): { minX: number; minY: number; maxX: number; maxY: number } | null => {
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const value = grayscale[y * width + x] ?? WHITE_PIXEL;

      if (value > threshold) {
        continue;
      }

      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    }
  }

  return maxX >= minX && maxY >= minY ? { minX, minY, maxX, maxY } : null;
};

export const preprocessGlyph = (imageData: ImageData): ProcessedGlyph => {
  const grayscale = toGrayscale(imageData);
  const threshold = otsuThreshold(grayscale);
  const bounds = findInkBounds(grayscale, imageData.width, imageData.height, threshold);

  if (!bounds) {
    return {
      imageData: createBlankGlyph(),
      hasInk: false,
    };
  }

  const output = createBlankGlyph();
  const destination = output.data;
  const inkWidth = Math.max(bounds.maxX - bounds.minX + 1, 1);
  const inkHeight = Math.max(bounds.maxY - bounds.minY + 1, 1);
  const scale = Math.min(
    (OUTPUT_WIDTH - PADDING * 2) / inkWidth,
    (OUTPUT_HEIGHT - PADDING * 2) / inkHeight,
  );
  const targetWidth = Math.max(1, Math.round(inkWidth * scale));
  const targetHeight = Math.max(1, Math.round(inkHeight * scale));
  const offsetX = Math.round((OUTPUT_WIDTH - targetWidth) / 2);
  const offsetY = Math.round((OUTPUT_HEIGHT - targetHeight) / 2);

  for (let y = 0; y < targetHeight; y += 1) {
    for (let x = 0; x < targetWidth; x += 1) {
      const sourceX = clamp(Math.round(bounds.minX + x / scale), bounds.minX, bounds.maxX);
      const sourceY = clamp(Math.round(bounds.minY + y / scale), bounds.minY, bounds.maxY);
      const sourceValue = grayscale[sourceY * imageData.width + sourceX] ?? WHITE_PIXEL;
      const destinationIndex = ((offsetY + y) * OUTPUT_WIDTH + (offsetX + x)) * 4;
      const pixelValue = sourceValue <= threshold ? BLACK_PIXEL : WHITE_PIXEL;

      destination[destinationIndex] = pixelValue;
      destination[destinationIndex + 1] = pixelValue;
      destination[destinationIndex + 2] = pixelValue;
      destination[destinationIndex + 3] = WHITE_PIXEL;
    }
  }

  return {
    imageData: output,
    hasInk: true,
  };
};
