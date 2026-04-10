// Design Ref: MTU-N86 §Golden Path 구조
// 헬스체크 엔드포인트

import { Router } from 'express';

export const healthRouter = Router();

healthRouter.get('/', (_req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || '0.0.0',
  });
});

healthRouter.get('/live', (_req, res) => {
  res.json({ status: 'alive' });
});
