// 사용자 관리 라우트
// Design Ref: DESIGN-MTU-P02, DESIGN-MTU-Q3, SVC-USER-R1 DESIGN
// Plan SC: FR-P02.1~FR-P02.10, FR-USR.1~FR-USR.6

import type { FastifyInstance } from 'fastify';
import {
  listUsersHandler,
  getUserHandler,
  createUserHandler,
  updateUserHandler,
  deleteUserHandler,
  reactivateUserHandler,
} from './handlers/user.handler.js';
import { changeRoleHandler } from './handlers/role.handler.js';
import { changePasswordHandler } from './handlers/password.handler.js';
import { requestPasswordResetHandler, confirmPasswordResetHandler } from './handlers/password-reset.handler.js';
import { listInactiveUsersHandler } from './handlers/inactive.handler.js';
import { userStatsHandler, loginActivityHandler } from './handlers/user-stats.handler.js';
import { createRateLimiter } from '@public-saas/rate-limit';

export async function registerUserRoutes(app: FastifyInstance): Promise<void> {
  // 서비스 수준 내부 인증 (CSAP D-08: 심층 방어)
  // API 게이트웨이가 인증 후 x-internal-service-key 헤더를 주입
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

  // FR-USR.3: Rate Limiting 미들웨어 (Design Ref: SVC-USER-R1 DESIGN §3)
  const readLimiter = createRateLimiter(100, 60, 'rl:user:read');
  const createLimiter = createRateLimiter(10, 60, 'rl:user:create');
  const updateLimiter = createRateLimiter(30, 60, 'rl:user:update');
  const deleteLimiter = createRateLimiter(5, 300, 'rl:user:delete');
  const passwordLimiter = createRateLimiter(5, 300, 'rl:user:password');
  const resetLimiter = createRateLimiter(5, 300, 'rl:user:reset');

  // OpenAPI JSON Schema 정의 (CSAP D-12: API 문서화)
  const idParam = { type: 'object' as const, properties: { id: { type: 'string' as const, format: 'uuid' } } };
  const userResponse = { type: 'object' as const, properties: { success: { type: 'boolean' as const }, data: { type: 'object' as const } } };
  const listResponse = { type: 'object' as const, properties: { success: { type: 'boolean' as const }, data: { type: 'array' as const, items: { type: 'object' as const } } } };

  // Plan SC: FR-P02.2, FR-USR.1 (검색/필터링 지원)
  app.get('/users', {
    schema: { description: '사용자 목록 조회', tags: ['users'], querystring: { type: 'object' as const, properties: { page: { type: 'integer' as const }, limit: { type: 'integer' as const }, role: { type: 'string' as const }, tenantId: { type: 'string' as const } } }, response: { 200: listResponse } },
    preHandler: readLimiter,
  }, listUsersHandler as never);

  // FR-USR.7: 사용자 통계 (정적 라우트 우선 등록)
  app.get('/users/stats', {
    schema: { description: '사용자 통계', tags: ['users'], response: { 200: userResponse } },
    preHandler: readLimiter,
  }, userStatsHandler as never);

  // FR-USR.8: 로그인 활동 추이 (정적 라우트 우선 등록)
  app.get('/users/login-activity', {
    schema: { description: '로그인 활동 추이 조회', tags: ['users'], querystring: { type: 'object' as const, properties: { days: { type: 'integer' as const, default: 30 } } }, response: { 200: userResponse } },
    preHandler: readLimiter,
  }, loginActivityHandler as never);

  // Plan SC: FR-USR.2 (비활성 계정 감지)
  app.get('/users/inactive', {
    schema: { description: '비활성 계정 목록 (CSAP D-08)', tags: ['users'], response: { 200: listResponse } },
    preHandler: readLimiter,
  }, listInactiveUsersHandler as never);

  app.get('/users/:id', {
    schema: { description: '사용자 상세 조회', tags: ['users'], params: idParam, response: { 200: userResponse } },
    preHandler: readLimiter,
  }, getUserHandler as never);

  // Plan SC: FR-P02.1
  app.post('/users', {
    schema: { description: '사용자 생성', tags: ['users'], body: { type: 'object' as const, required: ['email', 'name', 'role', 'tenantId'] as const, properties: { email: { type: 'string' as const, format: 'email' }, name: { type: 'string' as const }, role: { type: 'string' as const }, tenantId: { type: 'string' as const, format: 'uuid' } } }, response: { 201: userResponse } },
    preHandler: createLimiter,
  }, createUserHandler as never);

  // Plan SC: FR-P02.3
  app.put('/users/:id', {
    schema: { description: '사용자 수정', tags: ['users'], params: idParam, body: { type: 'object' as const, properties: { name: { type: 'string' as const }, email: { type: 'string' as const } } }, response: { 200: userResponse } },
    preHandler: updateLimiter,
  }, updateUserHandler as never);

  // Plan SC: FR-P02.4 (소프트 삭제 개선)
  app.delete('/users/:id', {
    schema: { description: '사용자 삭제 (소프트 삭제, CSAP D-08)', tags: ['users'], params: idParam, response: { 200: userResponse } },
    preHandler: deleteLimiter,
  }, deleteUserHandler as never);

  // Plan SC: FR-P02.4 (복원)
  app.put('/users/:id/reactivate', {
    schema: { description: '삭제된 사용자 복원', tags: ['users'], params: idParam, response: { 200: userResponse } },
    preHandler: updateLimiter,
  }, reactivateUserHandler as never);

  // Plan SC: FR-P02.5
  app.put('/users/:id/role', {
    schema: { description: '사용자 역할 변경 (CSAP D-08)', tags: ['users'], params: idParam, body: { type: 'object' as const, required: ['role'] as const, properties: { role: { type: 'string' as const } } }, response: { 200: userResponse } },
    preHandler: updateLimiter,
  }, changeRoleHandler as never);

  // Plan SC: FR-P02.6
  app.put('/users/:id/password', {
    schema: { description: '비밀번호 변경 (CSAP D-08-07)', tags: ['users'], params: idParam, body: { type: 'object' as const, required: ['currentPassword', 'newPassword'] as const, properties: { currentPassword: { type: 'string' as const }, newPassword: { type: 'string' as const, minLength: 8 } } }, response: { 200: userResponse } },
    preHandler: passwordLimiter,
  }, changePasswordHandler as never);

  // Plan SC: FR-P02.7 (비밀번호 재설정)
  app.post('/users/password-reset/request', {
    schema: { description: '비밀번호 재설정 요청', tags: ['users'], body: { type: 'object' as const, required: ['email'] as const, properties: { email: { type: 'string' as const, format: 'email' } } }, response: { 200: userResponse } },
    preHandler: resetLimiter,
  }, requestPasswordResetHandler as never);

  app.post('/users/password-reset/confirm', {
    schema: { description: '비밀번호 재설정 확인', tags: ['users'], body: { type: 'object' as const, required: ['token', 'newPassword'] as const, properties: { token: { type: 'string' as const }, newPassword: { type: 'string' as const, minLength: 8 } } }, response: { 200: userResponse } },
    preHandler: resetLimiter,
  }, confirmPasswordResetHandler as never);
}
