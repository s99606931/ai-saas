// Design Ref: MTU-N86 §Golden Path 구조
// Plan SC: FR-N86.1
// 공공기관 SaaS 서비스 엔트리포인트

import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import pino from 'pino';
import { register as metricsRegister } from 'prom-client';
import { healthRouter } from './health';

const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  // CSAP D-06: 감사 로그 구조화
  formatters: {
    level: (label) => ({ level: label }),
  },
});

const app = express();
const port = parseInt(process.env.PORT || '3000', 10);

// 보안 헤더 (CSAP D-08)
app.use(helmet());
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') || [],
  credentials: true,
}));

// 요청 파싱
app.use(express.json({ limit: '1mb' }));

// 헬스체크 (인증 불필요)
app.use('/health', healthRouter);
app.get('/ready', (_req, res) => res.json({ status: 'ready' }));

// Prometheus 메트릭 (인증 불필요)
app.get('/metrics', async (_req, res) => {
  res.set('Content-Type', metricsRegister.contentType);
  res.end(await metricsRegister.metrics());
});

// 서버 시작
app.listen(port, '0.0.0.0', () => {
  logger.info({ port }, '서비스 시작');
});

export default app;
