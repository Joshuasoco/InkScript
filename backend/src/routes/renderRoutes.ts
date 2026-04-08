import { Router } from 'express';

import { estimateRender } from '../controllers/renderController.js';

const renderRoutes = Router();

renderRoutes.post('/render/estimate', estimateRender);

export { renderRoutes };
