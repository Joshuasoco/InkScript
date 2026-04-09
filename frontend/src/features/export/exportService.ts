import type { RefObject } from 'react';

import { jsPDF } from 'jspdf';

import type { PageSize } from '../../types/handwriting';

export type ExportStatus = 'preparing' | 'rendering' | 'done';

export type ExportResult =
  | {
      success: true;
    }
  | {
      success: false;
      error: string;
    };

type ProgressCallback = (status: ExportStatus) => void;

const PNG_EXPORT_SCALE = 2;
const DEFAULT_AUTHOR = 'Text to Handwriting App';
const DEFAULT_PAGE_SIZE: PageSize = 'A4';
const PDF_PAGE_DIMENSIONS_MM: Record<PageSize, { width: number; height: number }> = {
  A4: { width: 210, height: 297 },
  Letter: { width: 215.9, height: 279.4 },
  Square: { width: 210, height: 210 },
};

const notifyProgress = (onProgress: ProgressCallback | undefined, status: ExportStatus): void => {
  onProgress?.(status);
};

const createSuccessResult = (): ExportResult => ({ success: true });

const createErrorResult = (error: string): ExportResult => ({
  success: false,
  error,
});

const sanitizeFilenameBase = (value: string): string =>
  Array.from(value, (character) => {
    const codePoint = character.codePointAt(0) ?? 0;

    if (codePoint <= 0x1f || '<>:"/\\|?*'.includes(character)) {
      return '-';
    }

    return character;
  }).join('');

const getCanvasElement = (canvasRef: RefObject<HTMLCanvasElement>): HTMLCanvasElement | null => {
  const canvas = canvasRef.current;

  if (!canvas) {
    return null;
  }

  if (canvas.width <= 0 || canvas.height <= 0) {
    return null;
  }

  return canvas;
};

const getCanvasDisplaySize = (
  canvas: HTMLCanvasElement,
): {
  width: number;
  height: number;
} => {
  const bounds = canvas.getBoundingClientRect();
  const width = Math.round(bounds.width || canvas.clientWidth || canvas.width);
  const height = Math.round(bounds.height || canvas.clientHeight || canvas.height);

  return {
    width: Math.max(width, 1),
    height: Math.max(height, 1),
  };
};

const createExportCanvas = (sourceCanvas: HTMLCanvasElement, scale: number): HTMLCanvasElement => {
  const { width, height } = getCanvasDisplaySize(sourceCanvas);
  const exportCanvas = document.createElement('canvas');

  exportCanvas.width = Math.max(1, Math.round(width * scale));
  exportCanvas.height = Math.max(1, Math.round(height * scale));

  const context = exportCanvas.getContext('2d');

  if (!context) {
    throw new Error('Unable to create a 2D export context.');
  }

  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = 'high';
  context.drawImage(sourceCanvas, 0, 0, exportCanvas.width, exportCanvas.height);

  return exportCanvas;
};

const canvasToBlob = (
  canvas: HTMLCanvasElement,
  type: string,
  quality?: number,
): Promise<Blob> =>
  new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error('The browser could not create the export file.'));
        return;
      }

      resolve(blob);
    }, type, quality);
  });

const normalizeFilename = (filename: string, extension: 'png' | 'pdf'): string => {
  const trimmed = filename.trim();
  const fallbackName = `handwriting-export.${extension}`;

  if (trimmed.length === 0) {
    return fallbackName;
  }

  const sanitizedBase = sanitizeFilenameBase(trimmed).replace(/-+/g, '-').replace(/\.+$/, '');

  if (sanitizedBase.length === 0) {
    return fallbackName;
  }

  const extensionPattern = new RegExp(`\\.${extension}$`, 'i');

  return extensionPattern.test(sanitizedBase) ? sanitizedBase : `${sanitizedBase}.${extension}`;
};

const triggerBrowserDownload = (blob: Blob, filename: string): void => {
  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement('a');

  anchor.href = objectUrl;
  anchor.download = filename;
  anchor.rel = 'noopener';
  anchor.style.display = 'none';

  document.body.append(anchor);
  anchor.click();
  anchor.remove();

  window.setTimeout(() => {
    URL.revokeObjectURL(objectUrl);
  }, 0);
};

const inferPageSizeFromCanvas = (canvas: HTMLCanvasElement): PageSize => {
  const previewContainer = canvas.closest<HTMLElement>('[data-page-size]');
  const pageSizeValue = previewContainer?.dataset.pageSize;

  if (pageSizeValue === 'A4' || pageSizeValue === 'Letter' || pageSizeValue === 'Square') {
    return pageSizeValue;
  }

  const { width, height } = getCanvasDisplaySize(canvas);
  const aspectRatio = width / height;

  if (Math.abs(aspectRatio - 1) < 0.05) {
    return 'Square';
  }

  const a4AspectRatio = 210 / 297;
  const letterAspectRatio = 8.5 / 11;

  return Math.abs(aspectRatio - a4AspectRatio) <= Math.abs(aspectRatio - letterAspectRatio)
    ? 'A4'
    : 'Letter';
};

const getPdfPageDimensions = (pageSize: PageSize): { width: number; height: number } =>
  PDF_PAGE_DIMENSIONS_MM[pageSize] ?? PDF_PAGE_DIMENSIONS_MM[DEFAULT_PAGE_SIZE];

const getPdfOrientation = (width: number, height: number): 'portrait' | 'landscape' =>
  width > height ? 'landscape' : 'portrait';

const getPdfTitle = (filename: string): string => filename.replace(/\.[^.]+$/, '');

export const exportAsPNG = async (
  canvasRef: RefObject<HTMLCanvasElement>,
  filename: string,
  onProgress?: ProgressCallback,
): Promise<ExportResult> => {
  notifyProgress(onProgress, 'preparing');

  const canvas = getCanvasElement(canvasRef);

  if (!canvas) {
    notifyProgress(onProgress, 'done');
    return createErrorResult('The handwriting canvas is not ready to export yet.');
  }

  try {
    notifyProgress(onProgress, 'rendering');

    const exportCanvas = createExportCanvas(canvas, PNG_EXPORT_SCALE);
    const blob = await canvasToBlob(exportCanvas, 'image/png');

    triggerBrowserDownload(blob, normalizeFilename(filename, 'png'));
    return createSuccessResult();
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'An unexpected error occurred while exporting PNG.';

    return createErrorResult(message);
  } finally {
    notifyProgress(onProgress, 'done');
  }
};

export const exportAsPDF = async (
  canvasRef: RefObject<HTMLCanvasElement>,
  filename: string,
  onProgress?: ProgressCallback,
): Promise<ExportResult> => {
  notifyProgress(onProgress, 'preparing');

  const canvas = getCanvasElement(canvasRef);

  if (!canvas) {
    notifyProgress(onProgress, 'done');
    return createErrorResult('The handwriting canvas is not ready to export yet.');
  }

  try {
    notifyProgress(onProgress, 'rendering');

    const pageSize = inferPageSizeFromCanvas(canvas);
    const pageDimensions = getPdfPageDimensions(pageSize);
    const exportCanvas = createExportCanvas(canvas, PNG_EXPORT_SCALE);
    const imageData = exportCanvas.toDataURL('image/png');
    const pdf = new jsPDF({
      orientation: getPdfOrientation(pageDimensions.width, pageDimensions.height),
      unit: 'mm',
      format: [pageDimensions.width, pageDimensions.height],
      compress: true,
      hotfixes: ['px_scaling'],
    });

    pdf.setProperties({
      title: getPdfTitle(normalizeFilename(filename, 'pdf')),
      author: DEFAULT_AUTHOR,
      creator: DEFAULT_AUTHOR,
    });
    pdf.setCreationDate(new Date());
    pdf.addImage(imageData, 'PNG', 0, 0, pageDimensions.width, pageDimensions.height);

    await pdf.save(normalizeFilename(filename, 'pdf'), { returnPromise: true });
    return createSuccessResult();
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'An unexpected error occurred while exporting PDF.';

    return createErrorResult(message);
  } finally {
    notifyProgress(onProgress, 'done');
  }
};
