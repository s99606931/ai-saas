// 보안 모니터링 서비스 라우트
// Design Ref: DESIGN-MTU-P15 §2

import type { FastifyInstance } from 'fastify';
import {
  loginFailuresHandler,
  anomaliesHandler,
  getBlocklistHandler,
  addBlocklistHandler,
  removeBlocklistHandler,
  alertsHandler,
} from './handlers/security.handler.js';

export async function registerRoutes(app: FastifyInstance): Promise<void> {
  // FR-P15.1: 로그인 실패 패턴 탐지
  app.get('/security/login-failures', loginFailuresHandler);

  // FR-P15.2: 이상 접근 패턴 탐지
  app.get('/security/anomalies', anomaliesHandler);

  // FR-P15.3: IP 차단 목록 관리
  app.get('/security/ip-blocklist', getBlocklistHandler);
  app.post('/security/ip-blocklist', addBlocklistHandler);
  app.delete('/security/ip-blocklist/:ip', removeBlocklistHandler);

  // FR-P15.4: 보안 이벤트 알림
  app.get('/security/alerts', alertsHandler);
}
