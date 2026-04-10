// 메뉴 서비스 라우트
// Design Ref: DESIGN-MTU-P05, SVC-MENU-R1 DESIGN
// Plan SC: FR-P05.1~FR-P05.5, FR-MENU.1~FR-MENU.5

import type { FastifyInstance } from 'fastify';
import {
  getMenuTreeHandler,
  getFilteredMenuHandler,
  createMenuHandler,
  updateMenuHandler,
  deleteMenuHandler,
  reorderMenuHandler,
  searchMenuHandler,
} from './handlers/menu.handler.js';
import { menuStatsHandler } from './handlers/menu-stats.handler.js';
import { createRateLimiter } from '@public-saas/rate-limit';

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

  // FR-MENU.1: Rate Limiting (Design Ref: SVC-MENU-R1 DESIGN)
  const readLimiter = createRateLimiter(100, 60, 'rl:menu:read');
  const writeLimiter = createRateLimiter(30, 60, 'rl:menu:write');
  const deleteLimiter = createRateLimiter(10, 300, 'rl:menu:delete');

  // 정적 경로 우선 등록 (Fastify 라우팅 우선순위)
  // FR-MENU.2: 메뉴 검색
  app.get('/menu/search', { preHandler: readLimiter }, searchMenuHandler as never);

  // FR-MENU.5: 메뉴 통계
  app.get('/menu/stats', { preHandler: readLimiter }, menuStatsHandler as never);

  // FR-P05.1: 메뉴 트리 조회
  app.get('/menu/tree', { preHandler: readLimiter }, getMenuTreeHandler as never);

  // FR-P05.2: 역할별 메뉴 필터링
  app.get('/menu/filtered', { preHandler: readLimiter }, getFilteredMenuHandler as never);

  // FR-P05.1: 메뉴 생성
  app.post('/menu', { preHandler: writeLimiter }, createMenuHandler as never);

  // FR-P05.1: 메뉴 수정
  app.put('/menu/:id', { preHandler: writeLimiter }, updateMenuHandler as never);

  // FR-P05.1: 메뉴 삭제 + FR-MENU.3 감사 로그
  app.delete('/menu/:id', { preHandler: deleteLimiter }, deleteMenuHandler as never);

  // FR-P05.3: 메뉴 순서 변경 + FR-MENU.4 테넌트 격리/감사
  app.put('/menu/:id/order', { preHandler: writeLimiter }, reorderMenuHandler as never);
}
