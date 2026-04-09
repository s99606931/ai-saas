// 파일 서비스 라우트
// Design Ref: DESIGN-MTU-P12
// Plan SC: FR-P12.1~FR-P12.5

import type { FastifyInstance } from 'fastify';
import {
  uploadFileHandler,
  downloadFileHandler,
  listFilesHandler,
  deleteFileHandler,
  getFileMetaHandler,
} from './handlers/file.handler.js';

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

  app.post('/file/upload', uploadFileHandler);
  app.get('/file/:id', downloadFileHandler);
  app.get('/file/list', listFilesHandler);
  app.delete('/file/:id', deleteFileHandler);
  app.get('/file/:id/meta', getFileMetaHandler);
}
