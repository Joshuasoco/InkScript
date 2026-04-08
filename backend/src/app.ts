import cors from 'cors';
import express from 'express';

import { errorHandler } from './middleware/errorHandler.js';
import { healthRoutes } from './routes/healthRoutes.js';
import { renderRoutes } from './routes/renderRoutes.js';

const app = express();

app.use(
  cors({
    origin: true,
    credentials: true,
  }),
);
app.use(express.json({ limit: '1mb' }));

app.use('/api', healthRoutes);
app.use('/api', renderRoutes);

app.use(errorHandler);

export default app;
