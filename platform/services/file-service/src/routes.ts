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
  app.post('/file/upload', uploadFileHandler);
  app.get('/file/:id', downloadFileHandler);
  app.get('/file/list', listFilesHandler);
  app.delete('/file/:id', deleteFileHandler);
  app.get('/file/:id/meta', getFileMetaHandler);
}
