export type HandwritingProcessingStage =
  | 'idle'
  | 'slicing'
  | 'preprocessing'
  | 'vectorizing'
  | 'building'
  | 'done';

export interface HandwritingProcessingProgress {
  stage: Exclude<HandwritingProcessingStage, 'idle' | 'done'>;
  completed: number;
  total: number;
  message: string;
}

export interface PreparedHandwritingUpload {
  imageData: ImageData;
  previewDataUrl: string;
  sourceWidth: number;
  sourceHeight: number;
  warning: string | null;
}

export interface GeneratedHandwritingFont {
  buffer: ArrayBuffer;
  filename: string;
  glyphCount: number;
  skippedCharacters: string[];
}

export interface MyHandwritingWorkerRequest {
  type: 'generate-font';
  payload: {
    width: number;
    height: number;
    pixels: ArrayBuffer;
  };
}

export interface MyHandwritingWorkerProgressMessage {
  type: 'progress';
  payload: HandwritingProcessingProgress;
}

export interface MyHandwritingWorkerSuccessMessage {
  type: 'success';
  payload: GeneratedHandwritingFont;
}

export interface MyHandwritingWorkerErrorMessage {
  type: 'error';
  payload: {
    message: string;
  };
}

export type MyHandwritingWorkerMessage =
  | MyHandwritingWorkerProgressMessage
  | MyHandwritingWorkerSuccessMessage
  | MyHandwritingWorkerErrorMessage;
