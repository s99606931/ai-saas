// 준수 현황 서비스 라우트
// Design Ref: DESIGN-MTU-P14 §2

import type { FastifyInstance } from 'fastify';
import {
  csapComplianceHandler,
  n2sfComplianceHandler,
  readinessHandler,
  metricsHandler,
} from './handlers/compliance.handler.js';

export async function registerRoutes(app: FastifyInstance): Promise<void> {
  // FR-P14.1: CSAP 79항목 준수율
  app.get('/compliance/csap', csapComplianceHandler);

  // FR-P14.2: N2SF 6영역 현황
  app.get('/compliance/n2sf', n2sfComplianceHandler);

  // FR-P14.3: 감리 준비도 점수
  app.get('/compliance/readiness', readinessHandler);

  // FR-P14.4: OpenTelemetry 메트릭
  app.get('/compliance/metrics', metricsHandler);
}
