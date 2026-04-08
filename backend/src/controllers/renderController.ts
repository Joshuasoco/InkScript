import type { NextFunction, Request, Response } from 'express';
import { ZodError, z } from 'zod';

import { estimateRenderMetrics } from '../services/renderService.js';
import type { ApiErrorResponse, RenderEstimateRequest } from '../types/api.js';

const estimateSchema = z.object({
  text: z.string().trim().min(1).max(50000),
  fontSize: z.number().min(12).max(32).default(22),
  lineSpacing: z.number().min(1).max(2.5).default(1.5),
  pageHeight: z.number().min(400).max(2000).default(1120),
});

export const estimateRender = (req: Request, res: Response, next: NextFunction): void => {
  try {
    const payload = estimateSchema.parse(req.body);
    const estimate = estimateRenderMetrics(payload as RenderEstimateRequest);

    res.status(200).json(estimate);
  } catch (error) {
    if (error instanceof ZodError) {
      const response: ApiErrorResponse = {
        message: 'Invalid render estimate payload',
        details: error.issues.map((issue) => issue.message),
      };

      res.status(400).json(response);
      return;
    }

    next(error);
  }
};
