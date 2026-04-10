// 파일 서비스 라우트
// Design Ref: DESIGN-MTU-P12, SVC-FILE-R1 DESIGN
// Plan SC: FR-P12.1~FR-P12.5, FR-FILE.1~FR-FILE.5

import type { FastifyInstance } from 'fastify';
import {
  uploadFileHandler,
  downloadFileHandler,
  listFilesHandler,
  deleteFileHandler,
  getFileMetaHandler,
} from './handlers/file.handler.js';
import { storageUsageHandler, fileStatsHandler } from './handlers/file-stats.handler.js';
import { createRateLimiter } from '@public-saas/rate-limit';

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

export async function registerRoutes(app: FastifyInstance): Promise<void> {
  // C-03 수정 (CSAP D-08): 서비스 간 내부 인증 — API 게이트웨이 우회 차단
  const internalKey = process.env['INTERNAL_SERVICE_KEY'];
  if (!internalKey && process.env['NODE_ENV'] === 'production') {
    throw new Error('[SECURITY] INTERNAL_SERVICE_KEY 환경변수가 설정되지 않았습니다. 서비스를 시작할 수 없습니다.');
  }
  if (internalKey) {
    app.addHook('onRequest', async (request, reply) => {
      // 헬스체크 경로 제외 (Kubernetes readinessProbe/livenessProbe 허용)
      if (request.url === '/health' || request.url === '/ready') return;
      const provided = request.headers['x-internal-service-key'];
      if (provided !== internalKey) {
        await reply.status(401).send({
          success: false,
          error: { code: 'UNAUTHORIZED', message: '내부 서비스 인증 실패' },
        });
      }
    });
  }

  // FR-FILE.1: Rate Limiting (Design Ref: SVC-FILE-R1 DESIGN)
  const readLimiter = createRateLimiter(100, 60, 'rl:file:read');
  const uploadLimiter = createRateLimiter(10, 60, 'rl:file:upload');
  const deleteLimiter = createRateLimiter(5, 300, 'rl:file:delete');

  // FR-P12.1: 파일 업로드
  app.post('/file/upload', {
    schema: {
      description: '파일 업로드 (멀티파트)',
      tags: ['file'],
      consumes: ['multipart/form-data'],
      response: { 201: successResponse, 400: errorResponse, 401: errorResponse, 413: errorResponse },
      security: [{ bearerAuth: [] }],
    },
    preHandler: uploadLimiter,
  }, uploadFileHandler as never);

  // FR-FILE.4: 저장 용량 조회 (정적 경로 우선 등록)
  app.get('/file/storage-usage', {
    schema: { description: '저장 용량 조회', tags: ['file'], response: { 200: successResponse, 401: errorResponse }, security: [{ bearerAuth: [] }] },
    preHandler: readLimiter,
  }, storageUsageHandler as never);

  // FR-FILE.5: 파일 통계 (정적 경로 우선 등록)
  app.get('/file/stats', {
    schema: { description: '파일 통계 조회', tags: ['file'], response: { 200: successResponse, 401: errorResponse }, security: [{ bearerAuth: [] }] },
    preHandler: readLimiter,
  }, fileStatsHandler as never);

  // FR-P12.1: 파일 목록 조회 + FR-FILE.2 검색/필터
  app.get('/file/list', {
    schema: {
      description: '파일 목록 조회 (검색/필터)',
      tags: ['file'],
      querystring: {
        type: 'object' as const,
        properties: {
          page: { type: 'integer' as const, minimum: 1, default: 1 },
          limit: { type: 'integer' as const, minimum: 1, maximum: 100, default: 20 },
          search: { type: 'string' as const },
          mimeType: { type: 'string' as const },
        },
      },
      response: { 200: successResponse, 401: errorResponse },
      security: [{ bearerAuth: [] }],
    },
    preHandler: readLimiter,
  }, listFilesHandler as never);

  // FR-P12.2: 파일 다운로드 + FR-FILE.3 감사 로그
  app.get('/file/:id', {
    schema: { description: '파일 다운로드 (감사 로그 기록)', tags: ['file'], params: idParam, response: { 200: { type: 'string' as const }, 401: errorResponse, 404: errorResponse }, security: [{ bearerAuth: [] }] },
    preHandler: readLimiter,
  }, downloadFileHandler as never);

  // FR-P12.1: 파일 메타데이터 조회
  app.get('/file/:id/meta', {
    schema: { description: '파일 메타데이터 조회', tags: ['file'], params: idParam, response: { 200: successResponse, 401: errorResponse, 404: errorResponse }, security: [{ bearerAuth: [] }] },
    preHandler: readLimiter,
  }, getFileMetaHandler as never);

  // FR-P12.1: 파일 삭제
  app.delete('/file/:id', {
    schema: { description: '파일 삭제', tags: ['file'], params: idParam, response: { 200: successResponse, 401: errorResponse, 404: errorResponse }, security: [{ bearerAuth: [] }] },
    preHandler: deleteLimiter,
  }, deleteFileHandler as never);
}
