// 보안 모니터링 서비스 라우트
// Design Ref: DESIGN-MTU-P15 §2

import type { FastifyInstance } from 'fastify';
import {
  loginFailuresHandler,
  anomaliesHandler,
  getIpBlocklistHandler,
  addIpBlocklistHandler,
  removeIpBlocklistHandler,
  securityAlertsHandler,
} from './handlers/security.handler.js';

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

  // FR-P15.1: 로그인 실패 패턴 탐지
  app.get('/security/login-failures', loginFailuresHandler);

  // FR-P15.2: 이상 접근 패턴 탐지
  app.get('/security/anomalies', anomaliesHandler);

  // FR-P15.3: IP 차단 목록 관리
  app.get('/security/ip-blocklist', getIpBlocklistHandler);
  app.post('/security/ip-blocklist', addIpBlocklistHandler);
  app.delete('/security/ip-blocklist/:ip', removeIpBlocklistHandler);

  // FR-P15.4: 보안 이벤트 알림
  app.get('/security/alerts', securityAlertsHandler);
}
