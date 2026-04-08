export interface RenderEstimateRequest {
  text: string;
  fontSize: number;
  lineSpacing: number;
  pageHeight: number;
}

export interface RenderEstimateResponse {
  lineCount: number;
  estimatedPages: number;
  estimatedRenderMs: number;
}

export interface ApiErrorResponse {
  message: string;
  details?: string[];
}
