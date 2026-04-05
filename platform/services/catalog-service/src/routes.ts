// 카탈로그 서비스 라우트
// Design Ref: DESIGN-MTU-P06
// Plan SC: FR-P06.1~FR-P06.5

import type { FastifyInstance } from 'fastify';
import {
  listServicesHandler,
  getServiceHandler,
  createServiceHandler,
  updateServiceHandler,
  deleteServiceHandler,
  updateVersionHandler,
  listFlagsHandler,
  toggleFlagHandler,
} from './handlers/catalog.handler.js';

export async function registerRoutes(app: FastifyInstance): Promise<void> {
  app.get('/catalog/services', listServicesHandler);
  app.get('/catalog/services/:id', getServiceHandler);
  app.post('/catalog/services', createServiceHandler);
  app.put('/catalog/services/:id', updateServiceHandler);
  app.delete('/catalog/services/:id', deleteServiceHandler);
  app.put('/catalog/services/:id/version', updateVersionHandler);
  app.get('/catalog/services/:id/flags', listFlagsHandler);
  app.put('/catalog/services/:id/flags/:key', toggleFlagHandler);
}
