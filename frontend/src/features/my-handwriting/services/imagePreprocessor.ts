import { HANDWRITING_TEMPLATE_CONFIG } from '../constants';

const OUTPUT_WIDTH = 72;
const OUTPUT_HEIGHT = 96;
const NORMALIZED_INK_WIDTH = 48;
const NORMALIZED_INK_HEIGHT = 64;
const INK_BOUNDS_PADDING = 4;
const WHITE_PIXEL = 255;
const BLACK_PIXEL = 0;
const MAX_GUIDE_INK_THRESHOLD = 165;
const BORDER_MASK_THICKNESS = 10;
const LABEL_MASK_WIDTH = 34;
const LABEL_MASK_HEIGHT = 30;
const BASELINE_MASK_THICKNESS = 16;
const MIN_INK_PIXELS = 10;
const MIN_COMPONENT_PIXELS = 4;
const EDGE_COMPONENT_MARGIN = 6;
const BASELINE_COMPONENT_MAX_HEIGHT = 14;
const BASELINE_COMPONENT_MIN_WIDTH_RATIO = 0.35;
const HORIZONTAL_GUIDE_MAX_HEIGHT = 12;
const HORIZONTAL_GUIDE_MIN_WIDTH_RATIO = 0.6;
const HORIZONTAL_GUIDE_MIN_Y_RATIO = 0.45;
const HORIZONTAL_GUIDE_MAX_Y_RATIO = 0.9;
const GUIDE_ROW_MIN_DARK_RATIO = 0.8;
const GUIDE_ROW_ERASE_RADIUS = 1;
const GUIDE_ROW_MIN_Y_RATIO = 0.35;
const GUIDE_ROW_MAX_Y_RATIO = 0.95;
const GUIDE_COLUMN_MIN_DARK_RATIO = 0.82;
const GUIDE_COLUMN_EDGE_MARGIN = 14;
const GUIDE_COLUMN_ERASE_RADIUS = 1;
const FRAME_COMPONENT_MIN_WIDTH_RATIO = 0.75;
const FRAME_COMPONENT_MIN_HEIGHT_RATIO = 0.75;
const FRAME_COMPONENT_MAX_DENSITY = 0.3;

export interface ProcessedGlyph {
  imageData: ImageData;
  hasInk: boolean;
}

interface InkBounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

interface ConnectedComponent extends InkBounds {
  pixelCount: number;
}

interface InkBoundsWithCount extends InkBounds {
  pixelCount: number;
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

const paintWhiteRect = (
  grayscale: Uint8ClampedArray,
  width: number,
  height: number,
  startX: number,
  startY: number,
  rectWidth: number,
  rectHeight: number,
): void => {
  const minX = Math.max(0, Math.floor(startX));
  const minY = Math.max(0, Math.floor(startY));
  const maxX = Math.min(width, Math.ceil(startX + rectWidth));
  const maxY = Math.min(height, Math.ceil(startY + rectHeight));

  for (let y = minY; y < maxY; y += 1) {
    for (let x = minX; x < maxX; x += 1) {
      grayscale[y * width + x] = WHITE_PIXEL;
    }
  }
};

const stripTemplateArtifacts = (
  grayscale: Uint8ClampedArray,
  width: number,
  height: number,
): Uint8ClampedArray => {
  const masked = grayscale.slice();

  paintWhiteRect(masked, width, height, 0, 0, width, BORDER_MASK_THICKNESS);
  paintWhiteRect(masked, width, height, 0, height - BORDER_MASK_THICKNESS, width, BORDER_MASK_THICKNESS);
  paintWhiteRect(masked, width, height, 0, 0, BORDER_MASK_THICKNESS, height);
  paintWhiteRect(masked, width, height, width - BORDER_MASK_THICKNESS, 0, BORDER_MASK_THICKNESS, height);
  paintWhiteRect(masked, width, height, 0, 0, LABEL_MASK_WIDTH, LABEL_MASK_HEIGHT);
  paintWhiteRect(
    masked,
    width,
    height,
    HANDWRITING_TEMPLATE_CONFIG.baselineInsetX,
    HANDWRITING_TEMPLATE_CONFIG.baselineOffsetY - BASELINE_MASK_THICKNESS / 2,
    width - HANDWRITING_TEMPLATE_CONFIG.baselineInsetX * 2,
    BASELINE_MASK_THICKNESS,
  );

  return masked;
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

const collectConnectedComponents = (
  grayscale: Uint8ClampedArray,
  width: number,
  height: number,
  threshold: number,
): ConnectedComponent[] => {
  const visited = new Uint8Array(width * height);
  const components: ConnectedComponent[] = [];
  const offsets = [
    [-1, -1],
    [0, -1],
    [1, -1],
    [-1, 0],
    [1, 0],
    [-1, 1],
    [0, 1],
    [1, 1],
  ] as const;

  for (let startY = 0; startY < height; startY += 1) {
    for (let startX = 0; startX < width; startX += 1) {
      const startIndex = startY * width + startX;

      if (visited[startIndex] === 1 || (grayscale[startIndex] ?? WHITE_PIXEL) > threshold) {
        continue;
      }

      const queue = [startIndex];
      visited[startIndex] = 1;
      let queueIndex = 0;
      let minX = startX;
      let minY = startY;
      let maxX = startX;
      let maxY = startY;
      let pixelCount = 0;

      while (queueIndex < queue.length) {
        const index = queue[queueIndex];

        queueIndex += 1;

        if (index === undefined) {
          continue;
        }

        const x = index % width;
        const y = Math.floor(index / width);

        pixelCount += 1;
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);

        offsets.forEach(([offsetX, offsetY]) => {
          const nextX = x + offsetX;
          const nextY = y + offsetY;

          if (nextX < 0 || nextY < 0 || nextX >= width || nextY >= height) {
            return;
          }

          const nextIndex = nextY * width + nextX;

          if (visited[nextIndex] === 1 || (grayscale[nextIndex] ?? WHITE_PIXEL) > threshold) {
            return;
          }

          visited[nextIndex] = 1;
          queue.push(nextIndex);
        });
      }

      components.push({ minX, minY, maxX, maxY, pixelCount });
    }
  }

  return components;
};

const shouldDiscardComponent = (
  component: ConnectedComponent,
  width: number,
  height: number,
): boolean => {
  const componentWidth = component.maxX - component.minX + 1;
  const componentHeight = component.maxY - component.minY + 1;
  const midpointY = (component.minY + component.maxY) / 2;
  const density = component.pixelCount / Math.max(componentWidth * componentHeight, 1);
  const touchesOuterEdge =
    component.minX <= EDGE_COMPONENT_MARGIN ||
    component.minY <= EDGE_COMPONENT_MARGIN ||
    component.maxX >= width - EDGE_COMPONENT_MARGIN - 1 ||
    component.maxY >= height - EDGE_COMPONENT_MARGIN - 1;

  if (component.pixelCount < MIN_COMPONENT_PIXELS) {
    return true;
  }

  if (component.maxX <= LABEL_MASK_WIDTH && component.maxY <= LABEL_MASK_HEIGHT) {
    return true;
  }

  if (
    componentWidth >= width * FRAME_COMPONENT_MIN_WIDTH_RATIO &&
    componentHeight >= height * FRAME_COMPONENT_MIN_HEIGHT_RATIO &&
    density <= FRAME_COMPONENT_MAX_DENSITY
  ) {
    return true;
  }

  if (
    componentHeight <= BASELINE_COMPONENT_MAX_HEIGHT &&
    componentWidth >= width * BASELINE_COMPONENT_MIN_WIDTH_RATIO &&
    Math.abs(midpointY - HANDWRITING_TEMPLATE_CONFIG.baselineOffsetY) <= BASELINE_MASK_THICKNESS * 1.5
  ) {
    return true;
  }

  if (
    componentHeight <= HORIZONTAL_GUIDE_MAX_HEIGHT &&
    componentWidth >= width * HORIZONTAL_GUIDE_MIN_WIDTH_RATIO &&
    midpointY >= height * HORIZONTAL_GUIDE_MIN_Y_RATIO &&
    midpointY <= height * HORIZONTAL_GUIDE_MAX_Y_RATIO
  ) {
    return true;
  }

  if (
    touchesOuterEdge &&
    (componentWidth >= width * 0.7 ||
      componentHeight >= height * 0.7 ||
      componentWidth <= BORDER_MASK_THICKNESS * 3 ||
      componentHeight <= BORDER_MASK_THICKNESS * 3)
  ) {
    return true;
  }

  if (
    componentHeight >= height * 0.75 &&
    componentWidth <= BORDER_MASK_THICKNESS * 2 &&
    (component.minX <= GUIDE_COLUMN_EDGE_MARGIN + 4 ||
      component.maxX >= width - GUIDE_COLUMN_EDGE_MARGIN - 5)
  ) {
    return true;
  }

  return false;
};

const removeTemplateNoise = (
  grayscale: Uint8ClampedArray,
  width: number,
  height: number,
  threshold: number,
): Uint8ClampedArray => {
  const cleaned = grayscale.slice();
  const components = collectConnectedComponents(cleaned, width, height, threshold);

  components.forEach((component) => {
    if (!shouldDiscardComponent(component, width, height)) {
      return;
    }

    for (let y = component.minY; y <= component.maxY; y += 1) {
      for (let x = component.minX; x <= component.maxX; x += 1) {
        const index = y * width + x;

        if ((cleaned[index] ?? WHITE_PIXEL) <= threshold) {
          cleaned[index] = WHITE_PIXEL;
        }
      }
    }
  });

  return cleaned;
};

const findInkBounds = (
  grayscale: Uint8ClampedArray,
  width: number,
  height: number,
  threshold: number,
): InkBoundsWithCount | null => {
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;
  let pixelCount = 0;

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if ((grayscale[y * width + x] ?? WHITE_PIXEL) > threshold) {
        continue;
      }

      pixelCount += 1;
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    }
  }

  if (pixelCount === 0 || maxX < minX || maxY < minY) {
    return null;
  }

  return {
    minX,
    minY,
    maxX,
    maxY,
    pixelCount,
  };
};

const suppressGuideStripes = (
  grayscale: Uint8ClampedArray,
  width: number,
  height: number,
  threshold: number,
): Uint8ClampedArray => {
  const cleaned = grayscale.slice();
  const rowMinY = Math.floor(height * GUIDE_ROW_MIN_Y_RATIO);
  const rowMaxY = Math.ceil(height * GUIDE_ROW_MAX_Y_RATIO);
  const rowsToErase = new Set<number>();
  const columnsToErase = new Set<number>();

  for (let y = rowMinY; y < rowMaxY; y += 1) {
    let darkCount = 0;

    for (let x = 0; x < width; x += 1) {
      if ((grayscale[y * width + x] ?? WHITE_PIXEL) <= threshold) {
        darkCount += 1;
      }
    }

    if (darkCount / Math.max(width, 1) >= GUIDE_ROW_MIN_DARK_RATIO) {
      rowsToErase.add(y);
    }
  }

  for (let x = 0; x < width; x += 1) {
    if (x > GUIDE_COLUMN_EDGE_MARGIN && x < width - GUIDE_COLUMN_EDGE_MARGIN - 1) {
      continue;
    }

    let darkCount = 0;

    for (let y = 0; y < height; y += 1) {
      if ((grayscale[y * width + x] ?? WHITE_PIXEL) <= threshold) {
        darkCount += 1;
      }
    }

    if (darkCount / Math.max(height, 1) >= GUIDE_COLUMN_MIN_DARK_RATIO) {
      columnsToErase.add(x);
    }
  }

  rowsToErase.forEach((rowY) => {
    for (
      let y = Math.max(0, rowY - GUIDE_ROW_ERASE_RADIUS);
      y <= Math.min(height - 1, rowY + GUIDE_ROW_ERASE_RADIUS);
      y += 1
    ) {
      for (let x = 0; x < width; x += 1) {
        cleaned[y * width + x] = WHITE_PIXEL;
      }
    }
  });

  columnsToErase.forEach((columnX) => {
    for (
      let x = Math.max(0, columnX - GUIDE_COLUMN_ERASE_RADIUS);
      x <= Math.min(width - 1, columnX + GUIDE_COLUMN_ERASE_RADIUS);
      x += 1
    ) {
      for (let y = 0; y < height; y += 1) {
        cleaned[y * width + x] = WHITE_PIXEL;
      }
    }
  });

  return cleaned;
};

export const preprocessGlyph = (imageData: ImageData): ProcessedGlyph => {
  const masked = stripTemplateArtifacts(toGrayscale(imageData), imageData.width, imageData.height);
  const threshold = Math.min(otsuThreshold(masked), MAX_GUIDE_INK_THRESHOLD);
  const stripeSuppressed = suppressGuideStripes(masked, imageData.width, imageData.height, threshold);
  const grayscale = removeTemplateNoise(stripeSuppressed, imageData.width, imageData.height, threshold);
  const inkBounds = findInkBounds(grayscale, imageData.width, imageData.height, threshold);

  if (!inkBounds || inkBounds.pixelCount < MIN_INK_PIXELS) {
    return {
      imageData: createBlankGlyph(),
      hasInk: false,
    };
  }

  const sourceMinX = clamp(inkBounds.minX - INK_BOUNDS_PADDING, 0, imageData.width - 1);
  const sourceMinY = clamp(inkBounds.minY - INK_BOUNDS_PADDING, 0, imageData.height - 1);
  const sourceMaxX = clamp(inkBounds.maxX + INK_BOUNDS_PADDING, 0, imageData.width - 1);
  const sourceMaxY = clamp(inkBounds.maxY + INK_BOUNDS_PADDING, 0, imageData.height - 1);
  const sourceWidth = Math.max(sourceMaxX - sourceMinX + 1, 1);
  const sourceHeight = Math.max(sourceMaxY - sourceMinY + 1, 1);
  const scale = Math.min(
    NORMALIZED_INK_WIDTH / sourceWidth,
    NORMALIZED_INK_HEIGHT / sourceHeight,
  );
  const targetWidth = Math.max(1, Math.round(sourceWidth * scale));
  const targetHeight = Math.max(1, Math.round(sourceHeight * scale));
  const sourceBaseline = clamp(
    HANDWRITING_TEMPLATE_CONFIG.baselineOffsetY,
    sourceMinY,
    sourceMaxY,
  );
  const scaledBaseline = Math.round((sourceBaseline - sourceMinY) * scale);
  const desiredOffsetY = HANDWRITING_TEMPLATE_CONFIG.baselineOffsetY - scaledBaseline;
  const offsetX = Math.round((OUTPUT_WIDTH - targetWidth) / 2);
  const offsetY = clamp(desiredOffsetY, 0, OUTPUT_HEIGHT - targetHeight);
  const output = createBlankGlyph();
  const destination = output.data;
  let darkPixelCount = 0;

  for (let y = 0; y < targetHeight; y += 1) {
    for (let x = 0; x < targetWidth; x += 1) {
      const sourceX = clamp(
        Math.round(sourceMinX + (x / Math.max(targetWidth - 1, 1)) * Math.max(sourceWidth - 1, 0)),
        sourceMinX,
        sourceMaxX,
      );
      const sourceY = clamp(
        Math.round(sourceMinY + (y / Math.max(targetHeight - 1, 1)) * Math.max(sourceHeight - 1, 0)),
        sourceMinY,
        sourceMaxY,
      );
      const value = grayscale[sourceY * imageData.width + sourceX] ?? WHITE_PIXEL;

      if (value <= threshold) {
        darkPixelCount += 1;
        const destinationIndex = ((offsetY + y) * OUTPUT_WIDTH + (offsetX + x)) * 4;

        destination[destinationIndex] = BLACK_PIXEL;
        destination[destinationIndex + 1] = BLACK_PIXEL;
        destination[destinationIndex + 2] = BLACK_PIXEL;
        destination[destinationIndex + 3] = WHITE_PIXEL;
      }
    }
  }

  if (darkPixelCount < MIN_INK_PIXELS) {
    return {
      imageData: createBlankGlyph(),
      hasInk: false,
    };
  }

  return {
    imageData: output,
    hasInk: true,
  };
};
