import { HANDWRITING_TEMPLATE_CONFIG, getTemplateCells } from '../constants';
import type { PreparedHandwritingUpload } from '../types';

const LOW_RESOLUTION_THRESHOLD = 1400;
const ASPECT_RATIO_WARNING_THRESHOLD = 0.18;
const BORDER_DETECTION_DELTA = 12;
const TEMPLATE_MATCH_THRESHOLD = 0.42;
const BORDER_SEARCH_RADIUS = 6;
const MAX_CORNER_OFFSET = 180;
const MIN_QUAD_AREA_RATIO = 0.3;
const MIN_PERSPECTIVE_IMPROVEMENT = 0.06;
const SEARCH_SCORE_EPSILON = 0.0005;
const HOMOGRAPHY_EPSILON = 0.000001;
const PERSPECTIVE_SEARCH_STEPS = [96, 48, 24, 12, 6, 3] as const;

interface Point {
  x: number;
  y: number;
}

interface PerspectiveQuad {
  topLeft: Point;
  topRight: Point;
  bottomRight: Point;
  bottomLeft: Point;
}

interface Homography {
  a: number;
  b: number;
  c: number;
  d: number;
  e: number;
  f: number;
  g: number;
  h: number;
}

const BACKGROUND_SAMPLE_POINTS = (() => {
  const inset = 28;
  const width = HANDWRITING_TEMPLATE_CONFIG.width;
  const height = HANDWRITING_TEMPLATE_CONFIG.height;

  return [
    [inset, inset],
    [width / 2, inset],
    [width - inset, inset],
    [inset, height / 2],
    [width - inset, height / 2],
    [inset, height - inset],
    [width / 2, height - inset],
    [width - inset, height - inset],
  ] as const;
})();

const BORDER_SAMPLE_POINTS: ReadonlyArray<readonly [number, number]> = (() => {
  const points: Array<readonly [number, number]> = [];

  getTemplateCells().forEach((cell) => {
    points.push(
      [cell.x + cell.width / 2, cell.y + 2],
      [cell.x + 2, cell.y + cell.height / 2],
      [cell.x + cell.width - 2, cell.y + cell.height / 2],
      [cell.x + cell.width / 2, cell.y + cell.height - 2],
    );
  });

  return points;
})();

const clamp = (value: number, min: number, max: number): number => {
  if (value < min) {
    return min;
  }

  if (value > max) {
    return max;
  }

  return value;
};

const toGrayscale = (imageData: ImageData): Uint8ClampedArray => {
  const grayscale = new Uint8ClampedArray(imageData.width * imageData.height);

  for (
    let sourceIndex = 0, grayIndex = 0;
    sourceIndex < imageData.data.length;
    sourceIndex += 4, grayIndex += 1
  ) {
    const red = imageData.data[sourceIndex] ?? 255;
    const green = imageData.data[sourceIndex + 1] ?? 255;
    const blue = imageData.data[sourceIndex + 2] ?? 255;

    grayscale[grayIndex] = Math.round(red * 0.299 + green * 0.587 + blue * 0.114);
  }

  return grayscale;
};

const getGrayscale = (
  grayscale: Uint8ClampedArray,
  width: number,
  height: number,
  x: number,
  y: number,
): number => {
  const clampedX = clamp(Math.round(x), 0, width - 1);
  const clampedY = clamp(Math.round(y), 0, height - 1);

  return grayscale[clampedY * width + clampedX] ?? 255;
};

const sampleGrayscaleBilinear = (
  grayscale: Uint8ClampedArray,
  width: number,
  height: number,
  x: number,
  y: number,
): number => {
  const clampedX = clamp(x, 0, width - 1);
  const clampedY = clamp(y, 0, height - 1);
  const x0 = Math.floor(clampedX);
  const y0 = Math.floor(clampedY);
  const x1 = Math.min(width - 1, x0 + 1);
  const y1 = Math.min(height - 1, y0 + 1);
  const tx = clampedX - x0;
  const ty = clampedY - y0;

  const top = (grayscale[y0 * width + x0] ?? 255) * (1 - tx) + (grayscale[y0 * width + x1] ?? 255) * tx;
  const bottom =
    (grayscale[y1 * width + x0] ?? 255) * (1 - tx) + (grayscale[y1 * width + x1] ?? 255) * tx;

  return top * (1 - ty) + bottom * ty;
};

const getDarkestGrayscaleInRadius = (
  grayscale: Uint8ClampedArray,
  width: number,
  height: number,
  x: number,
  y: number,
  radius: number,
): number => {
  let darkestLuminance = 255;
  const centerX = Math.round(x);
  const centerY = Math.round(y);

  for (let offsetY = -radius; offsetY <= radius; offsetY += 1) {
    for (let offsetX = -radius; offsetX <= radius; offsetX += 1) {
      darkestLuminance = Math.min(
        darkestLuminance,
        getGrayscale(grayscale, width, height, centerX + offsetX, centerY + offsetY),
      );
    }
  }

  return darkestLuminance;
};

const solveLinearSystem = (matrix: number[][], vector: number[]): number[] | null => {
  const size = vector.length;

  for (let pivotIndex = 0; pivotIndex < size; pivotIndex += 1) {
    let maxRow = pivotIndex;
    let maxValue = Math.abs(matrix[pivotIndex]?.[pivotIndex] ?? 0);

    for (let row = pivotIndex + 1; row < size; row += 1) {
      const value = Math.abs(matrix[row]?.[pivotIndex] ?? 0);

      if (value > maxValue) {
        maxValue = value;
        maxRow = row;
      }
    }

    if (maxValue < HOMOGRAPHY_EPSILON) {
      return null;
    }

    if (maxRow !== pivotIndex) {
      const tempRow = matrix[pivotIndex];

      matrix[pivotIndex] = matrix[maxRow] ?? [];
      matrix[maxRow] = tempRow ?? [];

      const tempValue = vector[pivotIndex] ?? 0;

      vector[pivotIndex] = vector[maxRow] ?? 0;
      vector[maxRow] = tempValue;
    }

    const pivotRow = matrix[pivotIndex];

    if (!pivotRow) {
      return null;
    }

    const pivotValue = pivotRow[pivotIndex] ?? 0;

    for (let col = pivotIndex; col < size; col += 1) {
      pivotRow[col] = (pivotRow[col] ?? 0) / pivotValue;
    }

    vector[pivotIndex] = (vector[pivotIndex] ?? 0) / pivotValue;

    for (let row = 0; row < size; row += 1) {
      if (row === pivotIndex) {
        continue;
      }

      const factor = matrix[row]?.[pivotIndex] ?? 0;

      if (Math.abs(factor) < HOMOGRAPHY_EPSILON) {
        continue;
      }

      const currentRow = matrix[row];

      if (!currentRow) {
        return null;
      }

      for (let col = pivotIndex; col < size; col += 1) {
        currentRow[col] = (currentRow[col] ?? 0) - factor * (pivotRow[col] ?? 0);
      }

      vector[row] = (vector[row] ?? 0) - factor * (vector[pivotIndex] ?? 0);
    }
  }

  return vector;
};

const computeHomography = (
  fromPoints: readonly Point[],
  toPoints: readonly Point[],
): Homography | null => {
  if (fromPoints.length !== 4 || toPoints.length !== 4) {
    return null;
  }

  const matrix: number[][] = [];
  const vector: number[] = [];

  for (let index = 0; index < 4; index += 1) {
    const from = fromPoints[index];
    const to = toPoints[index];

    if (!from || !to) {
      return null;
    }

    matrix.push([from.x, from.y, 1, 0, 0, 0, -to.x * from.x, -to.x * from.y]);
    vector.push(to.x);

    matrix.push([0, 0, 0, from.x, from.y, 1, -to.y * from.x, -to.y * from.y]);
    vector.push(to.y);
  }

  const solution = solveLinearSystem(
    matrix.map((row) => row.slice()),
    vector.slice(),
  );

  if (!solution || solution.length !== 8 || solution.some((value) => !Number.isFinite(value))) {
    return null;
  }

  return {
    a: solution[0] ?? 0,
    b: solution[1] ?? 0,
    c: solution[2] ?? 0,
    d: solution[3] ?? 0,
    e: solution[4] ?? 0,
    f: solution[5] ?? 0,
    g: solution[6] ?? 0,
    h: solution[7] ?? 0,
  };
};

const mapPointWithHomography = (homography: Homography, x: number, y: number): Point => {
  const denominator = homography.g * x + homography.h * y + 1;

  if (Math.abs(denominator) < HOMOGRAPHY_EPSILON) {
    return { x, y };
  }

  return {
    x: (homography.a * x + homography.b * y + homography.c) / denominator,
    y: (homography.d * x + homography.e * y + homography.f) / denominator,
  };
};

const createIdentityQuad = (width: number, height: number): PerspectiveQuad => ({
  topLeft: { x: 0, y: 0 },
  topRight: { x: width - 1, y: 0 },
  bottomRight: { x: width - 1, y: height - 1 },
  bottomLeft: { x: 0, y: height - 1 },
});

const cloneQuad = (quad: PerspectiveQuad): PerspectiveQuad => ({
  topLeft: { ...quad.topLeft },
  topRight: { ...quad.topRight },
  bottomRight: { ...quad.bottomRight },
  bottomLeft: { ...quad.bottomLeft },
});

const quadToPoints = (quad: PerspectiveQuad): Point[] => [
  quad.topLeft,
  quad.topRight,
  quad.bottomRight,
  quad.bottomLeft,
];

const getRectangleCorners = (width: number, height: number): Point[] => [
  { x: 0, y: 0 },
  { x: width - 1, y: 0 },
  { x: width - 1, y: height - 1 },
  { x: 0, y: height - 1 },
];

const getPolygonArea = (points: readonly Point[]): number => {
  let area = 0;

  for (let index = 0; index < points.length; index += 1) {
    const current = points[index];
    const next = points[(index + 1) % points.length];

    area += (current?.x ?? 0) * (next?.y ?? 0) - (next?.x ?? 0) * (current?.y ?? 0);
  }

  return Math.abs(area) / 2;
};

const isConvexQuad = (quad: PerspectiveQuad): boolean => {
  const points = quadToPoints(quad);
  let sign = 0;

  for (let index = 0; index < points.length; index += 1) {
    const first = points[index];
    const second = points[(index + 1) % points.length];
    const third = points[(index + 2) % points.length];
    const cross =
      ((second?.x ?? 0) - (first?.x ?? 0)) * ((third?.y ?? 0) - (second?.y ?? 0)) -
      ((second?.y ?? 0) - (first?.y ?? 0)) * ((third?.x ?? 0) - (second?.x ?? 0));

    if (Math.abs(cross) < HOMOGRAPHY_EPSILON) {
      continue;
    }

    const currentSign = Math.sign(cross);

    if (sign === 0) {
      sign = currentSign;
      continue;
    }

    if (currentSign !== sign) {
      return false;
    }
  }

  return true;
};

const isValidQuad = (quad: PerspectiveQuad, width: number, height: number): boolean => {
  if (!isConvexQuad(quad)) {
    return false;
  }

  const area = getPolygonArea(quadToPoints(quad));

  return area >= width * height * MIN_QUAD_AREA_RATIO;
};

const getBackgroundLuminanceForHomography = (
  grayscale: Uint8ClampedArray,
  width: number,
  height: number,
  homography: Homography,
): number => {
  const luminanceValues = BACKGROUND_SAMPLE_POINTS
    .map(([x, y]) => {
      const sourcePoint = mapPointWithHomography(homography, x, y);

      return sampleGrayscaleBilinear(grayscale, width, height, sourcePoint.x, sourcePoint.y);
    })
    .sort((left, right) => left - right);
  const middleIndex = Math.floor(luminanceValues.length / 2);

  return luminanceValues.length % 2 === 0
    ? ((luminanceValues[middleIndex - 1] ?? 255) + (luminanceValues[middleIndex] ?? 255)) / 2
    : (luminanceValues[middleIndex] ?? 255);
};

const measureTemplateMatchForHomography = (
  grayscale: Uint8ClampedArray,
  width: number,
  height: number,
  homography: Homography,
): number => {
  const backgroundLuminance = getBackgroundLuminanceForHomography(
    grayscale,
    width,
    height,
    homography,
  );
  let detectedBorderSamples = 0;

  BORDER_SAMPLE_POINTS.forEach(([x, y]) => {
    const sourcePoint = mapPointWithHomography(homography, x, y);

    if (
      backgroundLuminance -
        getDarkestGrayscaleInRadius(grayscale, width, height, sourcePoint.x, sourcePoint.y, BORDER_SEARCH_RADIUS) >=
      BORDER_DETECTION_DELTA
    ) {
      detectedBorderSamples += 1;
    }
  });

  return BORDER_SAMPLE_POINTS.length > 0 ? detectedBorderSamples / BORDER_SAMPLE_POINTS.length : 0;
};

const measureTemplateMatchForQuad = (
  grayscale: Uint8ClampedArray,
  width: number,
  height: number,
  quad: PerspectiveQuad,
): number => {
  const homography = computeHomography(getRectangleCorners(width, height), quadToPoints(quad));

  if (!homography) {
    return 0;
  }

  return measureTemplateMatchForHomography(grayscale, width, height, homography);
};

const optimizePerspectiveQuad = (
  grayscale: Uint8ClampedArray,
  width: number,
  height: number,
): { quad: PerspectiveQuad; score: number } => {
  const minX = -MAX_CORNER_OFFSET;
  const maxX = width - 1 + MAX_CORNER_OFFSET;
  const minY = -MAX_CORNER_OFFSET;
  const maxY = height - 1 + MAX_CORNER_OFFSET;
  const cornerKeys: Array<keyof PerspectiveQuad> = [
    'topLeft',
    'topRight',
    'bottomRight',
    'bottomLeft',
  ];
  const axes: Array<'x' | 'y'> = ['x', 'y'];

  let bestQuad = createIdentityQuad(width, height);
  let bestScore = measureTemplateMatchForQuad(grayscale, width, height, bestQuad);

  PERSPECTIVE_SEARCH_STEPS.forEach((step) => {
    let improved = true;

    while (improved) {
      improved = false;

      cornerKeys.forEach((cornerKey) => {
        axes.forEach((axis) => {
          ([-1, 1] as const).forEach((direction) => {
            const candidate = cloneQuad(bestQuad);
            const currentValue = candidate[cornerKey][axis];
            const nextValue = clamp(
              currentValue + direction * step,
              axis === 'x' ? minX : minY,
              axis === 'x' ? maxX : maxY,
            );

            if (nextValue === currentValue) {
              return;
            }

            candidate[cornerKey][axis] = nextValue;

            if (!isValidQuad(candidate, width, height)) {
              return;
            }

            const score = measureTemplateMatchForQuad(grayscale, width, height, candidate);

            if (score > bestScore + SEARCH_SCORE_EPSILON) {
              bestQuad = candidate;
              bestScore = score;
              improved = true;
            }
          });
        });
      });
    }
  });

  return {
    quad: bestQuad,
    score: bestScore,
  };
};

const sampleColorBilinear = (
  imageData: ImageData,
  x: number,
  y: number,
): readonly [number, number, number, number] => {
  const clampedX = clamp(x, 0, imageData.width - 1);
  const clampedY = clamp(y, 0, imageData.height - 1);
  const x0 = Math.floor(clampedX);
  const y0 = Math.floor(clampedY);
  const x1 = Math.min(imageData.width - 1, x0 + 1);
  const y1 = Math.min(imageData.height - 1, y0 + 1);
  const tx = clampedX - x0;
  const ty = clampedY - y0;

  const index00 = (y0 * imageData.width + x0) * 4;
  const index10 = (y0 * imageData.width + x1) * 4;
  const index01 = (y1 * imageData.width + x0) * 4;
  const index11 = (y1 * imageData.width + x1) * 4;

  const sampleChannel = (channel: number): number => {
    const top =
      (imageData.data[index00 + channel] ?? 255) * (1 - tx) +
      (imageData.data[index10 + channel] ?? 255) * tx;
    const bottom =
      (imageData.data[index01 + channel] ?? 255) * (1 - tx) +
      (imageData.data[index11 + channel] ?? 255) * tx;

    return top * (1 - ty) + bottom * ty;
  };

  return [sampleChannel(0), sampleChannel(1), sampleChannel(2), sampleChannel(3)] as const;
};

const warpPerspective = (imageData: ImageData, quad: PerspectiveQuad): ImageData => {
  const width = imageData.width;
  const height = imageData.height;
  const homography = computeHomography(getRectangleCorners(width, height), quadToPoints(quad));

  if (!homography) {
    return imageData;
  }

  const data = new Uint8ClampedArray(width * height * 4);

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const sourcePoint = mapPointWithHomography(homography, x, y);
      const [red, green, blue, alpha] = sampleColorBilinear(imageData, sourcePoint.x, sourcePoint.y);
      const index = (y * width + x) * 4;

      data[index] = Math.round(red);
      data[index + 1] = Math.round(green);
      data[index + 2] = Math.round(blue);
      data[index + 3] = Math.round(alpha);
    }
  }

  return new ImageData(data, width, height);
};

const createTemplateCanvas = (): HTMLCanvasElement => {
  const canvas = document.createElement('canvas');

  canvas.width = HANDWRITING_TEMPLATE_CONFIG.width;
  canvas.height = HANDWRITING_TEMPLATE_CONFIG.height;

  return canvas;
};

const formatConfidence = (score: number): string => `${Math.round(score * 100)}%`;

const getLuminance = (imageData: ImageData, x: number, y: number): number => {
  const clampedX = Math.max(0, Math.min(imageData.width - 1, Math.round(x)));
  const clampedY = Math.max(0, Math.min(imageData.height - 1, Math.round(y)));
  const index = (clampedY * imageData.width + clampedX) * 4;
  const red = imageData.data[index] ?? 255;
  const green = imageData.data[index + 1] ?? 255;
  const blue = imageData.data[index + 2] ?? 255;

  return red * 0.299 + green * 0.587 + blue * 0.114;
};

const getBackgroundLuminance = (imageData: ImageData): number => {
  const inset = 28;
  const points = [
    [inset, inset],
    [imageData.width / 2, inset],
    [imageData.width - inset, inset],
    [inset, imageData.height / 2],
    [imageData.width - inset, imageData.height / 2],
    [inset, imageData.height - inset],
    [imageData.width / 2, imageData.height - inset],
    [imageData.width - inset, imageData.height - inset],
  ] as const;

  const luminanceValues = points
    .map(([x, y]) => getLuminance(imageData, x, y))
    .sort((left, right) => left - right);
  const middleIndex = Math.floor(luminanceValues.length / 2);

  return luminanceValues.length % 2 === 0
    ? ((luminanceValues[middleIndex - 1] ?? 255) + (luminanceValues[middleIndex] ?? 255)) / 2
    : (luminanceValues[middleIndex] ?? 255);
};

const getDarkestLuminanceInRadius = (
  imageData: ImageData,
  x: number,
  y: number,
  radius: number,
): number => {
  let darkestLuminance = 255;

  for (let offsetY = -radius; offsetY <= radius; offsetY += 1) {
    for (let offsetX = -radius; offsetX <= radius; offsetX += 1) {
      darkestLuminance = Math.min(
        darkestLuminance,
        getLuminance(imageData, x + offsetX, y + offsetY),
      );
    }
  }

  return darkestLuminance;
};

export const measureTemplateMatch = (imageData: ImageData): number => {
  const backgroundLuminance = getBackgroundLuminance(imageData);
  let detectedBorderSamples = 0;
  let totalBorderSamples = 0;

  getTemplateCells().forEach((cell) => {
    const samplePoints = [
      [cell.x + cell.width / 2, cell.y + 2],
      [cell.x + 2, cell.y + cell.height / 2],
      [cell.x + cell.width - 2, cell.y + cell.height / 2],
      [cell.x + cell.width / 2, cell.y + cell.height - 2],
    ] as const;

    samplePoints.forEach(([x, y]) => {
      totalBorderSamples += 1;

      if (
        backgroundLuminance - getDarkestLuminanceInRadius(imageData, x, y, BORDER_SEARCH_RADIUS) >=
        BORDER_DETECTION_DELTA
      ) {
        detectedBorderSamples += 1;
      }
    });
  });

  return totalBorderSamples > 0 ? detectedBorderSamples / totalBorderSamples : 0;
};

export const correctTemplatePerspective = (imageData: ImageData): ImageData => {
  const grayscale = toGrayscale(imageData);
  const baselineQuad = createIdentityQuad(imageData.width, imageData.height);
  const baselineScore = measureTemplateMatchForQuad(grayscale, imageData.width, imageData.height, baselineQuad);
  const optimized = optimizePerspectiveQuad(grayscale, imageData.width, imageData.height);

  if (optimized.score - baselineScore < MIN_PERSPECTIVE_IMPROVEMENT) {
    return imageData;
  }

  const corrected = warpPerspective(imageData, optimized.quad);
  const correctedScore = measureTemplateMatch(corrected);

  return correctedScore + SEARCH_SCORE_EPSILON >= baselineScore ? corrected : imageData;
};

const buildWarning = (
  sourceWidth: number,
  sourceHeight: number,
  isTemplateCompatible: boolean,
  templateMatchScore: number,
): string | null => {
  if (!isTemplateCompatible) {
    return `Template alignment is too low (${formatConfidence(
      templateMatchScore,
    )}). Retake a straight, well-lit photo with only the printed template page in frame.`;
  }

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

  const roughImageData = context.getImageData(0, 0, canvas.width, canvas.height);
  const imageData = correctTemplatePerspective(roughImageData);

  if (imageData !== roughImageData) {
    context.putImageData(imageData, 0, 0);
  }

  const templateMatchScore = measureTemplateMatch(imageData);
  const isTemplateCompatible = templateMatchScore >= TEMPLATE_MATCH_THRESHOLD;

  return {
    imageData,
    previewDataUrl: canvas.toDataURL('image/png'),
    sourceWidth,
    sourceHeight,
    warning: buildWarning(sourceWidth, sourceHeight, isTemplateCompatible, templateMatchScore),
    isTemplateCompatible,
    templateMatchScore,
  };
};
