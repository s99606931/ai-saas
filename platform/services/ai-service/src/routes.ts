// AI 서비스 라우트
// Design Ref: DESIGN-MTU-P10
// Plan SC: FR-P10.1~FR-P10.6

import type { FastifyInstance } from 'fastify';
import {
  listModelsHandler,
  createModelHandler,
  updateModelHandler,
  chatHandler,
  usageHandler,
  costHandler,
} from './handlers/ai.handler.js';

export async function registerRoutes(app: FastifyInstance): Promise<void> {
  app.get('/ai/models', listModelsHandler);
  app.post('/ai/models', createModelHandler);
  app.put('/ai/models/:id', updateModelHandler);
  app.post('/ai/chat', chatHandler);
  app.get('/ai/usage', usageHandler);
  app.get('/ai/cost', costHandler);
}
