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
import { submitCatalog, approveCatalog, rejectCatalog, deprecateCatalog } from './handlers/workflow.handler.js';
import { getCatalogStats } from './handlers/stats.handler.js';

// OpenAPI JSON Schema 정의 (CSAP D-12: API 문서화)
const successResponse = {
  type: 'object' as const,
  additionalProperties: true, properties: { success: { type: 'boolean' as const }, data: { type: 'object' as const, additionalProperties: true } },
} as const;

const errorResponse = {
  type: 'object' as const,
  additionalProperties: true, properties: { success: { type: 'boolean' as const }, error: { type: 'object' as const, additionalProperties: true } },
} as const;

const idParam = {
  type: 'object' as const, required: ['id'] as const, properties: { id: { type: 'string' as const } },
} as const;

const paginationQuery = {
  type: 'object' as const,
  properties: {
    page: { type: 'integer' as const, minimum: 1, default: 1 },
    limit: { type: 'integer' as const, minimum: 1, maximum: 100, default: 20 },
    search: { type: 'string' as const },
    category: { type: 'string' as const },
    status: { type: 'string' as const },
  },
} as const;

/**
 * SaaS 카탈로그 서비스 라우트 등록
 */
export async function registerRoutes(app: FastifyInstance): Promise<void> {
  // FR-SCAT.2: 카테고리 목록 (정적, 인증 불필요)
  app.get('/saas-catalog/categories', {
    schema: {
      description: 'SaaS 카테고리 목록 조회',
      tags: ['saas-catalog'],
      response: {
        200: {
          type: 'object' as const,
          additionalProperties: true,
          properties: {
            success: { type: 'boolean' as const },
            data: { type: 'array' as const, items: { type: 'object' as const, additionalProperties: true } },
          },
        },
      },
    },
  }, listCategories);

  // FR-SCAT.5: 통계 (stats를 :id보다 먼저 등록)
  app.get('/saas-catalog/stats', {
    schema: { description: 'SaaS 카탈로그 통계', tags: ['saas-catalog'], response: { 200: successResponse, 401: errorResponse }, security: [{ bearerAuth: [] }] },
  }, getCatalogStats);

  // FR-SCAT.1: CRUD
  app.post('/saas-catalog', {
    schema: {
      description: 'SaaS 카탈로그 등록',
      tags: ['saas-catalog'],
      body: {
        type: 'object' as const,
        required: ['name', 'category', 'description'],
        properties: {
          name: { type: 'string' as const, minLength: 1 },
          category: { type: 'string' as const },
          description: { type: 'string' as const },
          version: { type: 'string' as const },
          provider: { type: 'string' as const },
          pricing: { type: 'object' as const },
        },
      },
      response: { 201: successResponse, 400: errorResponse, 401: errorResponse },
      security: [{ bearerAuth: [] }],
    },
  }, createCatalog);
  app.get('/saas-catalog', {
    schema: { description: 'SaaS 카탈로그 목록 조회', tags: ['saas-catalog'], querystring: paginationQuery, response: { 200: successResponse } },
  }, listCatalog);
  app.get('/saas-catalog/:id', {
    schema: { description: 'SaaS 카탈로그 상세 조회', tags: ['saas-catalog'], params: idParam, response: { 200: successResponse, 404: errorResponse } },
  }, getCatalog);
  app.put('/saas-catalog/:id', {
    schema: {
      description: 'SaaS 카탈로그 수정',
      tags: ['saas-catalog'],
      params: idParam,
      body: { type: 'object' as const, properties: { name: { type: 'string' as const }, category: { type: 'string' as const }, description: { type: 'string' as const }, version: { type: 'string' as const } } },
      response: { 200: successResponse, 400: errorResponse, 401: errorResponse, 404: errorResponse },
      security: [{ bearerAuth: [] }],
    },
  }, updateCatalog);
  app.delete('/saas-catalog/:id', {
    schema: { description: 'SaaS 카탈로그 삭제', tags: ['saas-catalog'], params: idParam, response: { 200: successResponse, 401: errorResponse, 404: errorResponse }, security: [{ bearerAuth: [] }] },
  }, deleteCatalog);

  // FR-SCAT.4: 승인 워크플로
  app.post('/saas-catalog/:id/submit', {
    schema: { description: '승인 제출', tags: ['saas-catalog'], params: idParam, response: { 200: successResponse, 401: errorResponse, 404: errorResponse }, security: [{ bearerAuth: [] }] },
  }, submitCatalog);
  app.post('/saas-catalog/:id/approve', {
    schema: { description: '승인 처리', tags: ['saas-catalog'], params: idParam, response: { 200: successResponse, 401: errorResponse, 404: errorResponse }, security: [{ bearerAuth: [] }] },
  }, approveCatalog);
  app.post('/saas-catalog/:id/reject', {
    schema: {
      description: '반려 처리',
      tags: ['saas-catalog'],
      params: idParam,
      body: { type: 'object' as const, properties: { reason: { type: 'string' as const } } },
      response: { 200: successResponse, 401: errorResponse, 404: errorResponse },
      security: [{ bearerAuth: [] }],
    },
  }, rejectCatalog);
  app.post('/saas-catalog/:id/deprecate', {
    schema: { description: '서비스 폐기 처리', tags: ['saas-catalog'], params: idParam, response: { 200: successResponse, 401: errorResponse, 404: errorResponse }, security: [{ bearerAuth: [] }] },
  }, deprecateCatalog);
}
