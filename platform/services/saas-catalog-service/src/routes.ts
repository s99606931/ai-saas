// SaaS 카탈로그 서비스 라우트 등록
// Design Ref: SVC-SAASCAT-R3 DESIGN
// Plan SC: FR-SCAT.1~FR-SCAT.7

import type { FastifyInstance } from 'fastify';
import {
  createCatalog,
  listCatalog,
  listCategories,
  getCatalog,
  updateCatalog,
  deleteCatalog,
} from './handlers/catalog.handler.js';
import {
  submitCatalog,
  approveCatalog,
  rejectCatalog,
  deprecateCatalog,
} from './handlers/workflow.handler.js';
import { getCatalogStats } from './handlers/stats.handler.js';

/**
 * SaaS 카탈로그 서비스 라우트 등록
 */
export async function registerRoutes(app: FastifyInstance): Promise<void> {
  // FR-SCAT.2: 카테고리 목록 (정적, 인증 불필요)
  app.get('/saas-catalog/categories', listCategories);

  // FR-SCAT.5: 통계 (stats를 :id보다 먼저 등록)
  app.get('/saas-catalog/stats', getCatalogStats);

  // FR-SCAT.1: CRUD
  app.post('/saas-catalog', createCatalog);
  app.get('/saas-catalog', listCatalog);
  app.get('/saas-catalog/:id', getCatalog);
  app.put('/saas-catalog/:id', updateCatalog);
  app.delete('/saas-catalog/:id', deleteCatalog);

  // FR-SCAT.4: 승인 워크플로
  app.post('/saas-catalog/:id/submit', submitCatalog);
  app.post('/saas-catalog/:id/approve', approveCatalog);
  app.post('/saas-catalog/:id/reject', rejectCatalog);
  app.post('/saas-catalog/:id/deprecate', deprecateCatalog);
}
