export type PaperType = 'lined' | 'blank' | 'grid' | 'dotted';

export interface HandwritingSettings {
  fontFamily: string;
  inkColor: string;
  fontSize: number;
  lineSpacing: number;
  letterVariation: number;
  paperType: PaperType;
}

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
