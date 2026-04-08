import { Router } from 'express';

const healthRoutes = Router();

healthRoutes.get('/health', (_request, response) => {
  response.status(200).json({
    service: 'text-to-handwriting-api',
    status: 'ok',
    timestamp: new Date().toISOString(),
  });
});

export { healthRoutes };
