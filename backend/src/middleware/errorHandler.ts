import type { ErrorRequestHandler } from 'express';

import type { ApiErrorResponse } from '../types/api.js';

export const errorHandler: ErrorRequestHandler = (error, _request, response, _next) => {
  void _next;
  console.error(error);

  const payload: ApiErrorResponse = {
    message: 'Unexpected server error',
  };

  response.status(500).json(payload);
};
