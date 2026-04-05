// 인증 라우트 등록
// Design Ref: DESIGN-MTU-P01 Section 2 API 설계

import type { FastifyInstance } from 'fastify';
import { loginHandler } from './handlers/login.handler.js';
import { logoutHandler } from './handlers/logout.handler.js';
import { refreshHandler } from './handlers/refresh.handler.js';
import { verifyHandler } from './handlers/verify.handler.js';
import { mfaSetupHandler, mfaVerifyHandler, mfaDisableHandler } from './handlers/mfa.handler.js';

export async function registerAuthRoutes(app: FastifyInstance): Promise<void> {
  // POST /auth/login — 로그인
  // Plan SC: FR-P01.1
  app.post('/auth/login', loginHandler);

  // POST /auth/logout — 로그아웃
  // Plan SC: FR-P01.4
  app.post('/auth/logout', logoutHandler);

  // POST /auth/refresh — 토큰 갱신
  // Plan SC: FR-P01.3
  app.post('/auth/refresh', refreshHandler);

  // GET /auth/verify — 토큰 검증
  // Plan SC: FR-P01.2
  app.get('/auth/verify', verifyHandler);

  // POST /auth/mfa/setup — MFA TOTP 등록 시작
  // Plan SC: FR-P01.10
  app.post('/auth/mfa/setup', mfaSetupHandler);

  // POST /auth/mfa/verify — MFA TOTP 등록 검증/활성화
  // Plan SC: FR-P01.10
  app.post('/auth/mfa/verify', mfaVerifyHandler);

  // DELETE /auth/mfa — MFA 비활성화
  // Plan SC: FR-P01.10
  app.delete('/auth/mfa', mfaDisableHandler);
}
