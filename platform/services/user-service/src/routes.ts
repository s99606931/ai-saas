// 사용자 관리 라우트
// Design Ref: DESIGN-MTU-P02, DESIGN-MTU-Q3
// Plan SC: FR-P02.1~FR-P02.10

import type { FastifyInstance } from 'fastify';
import { listUsersHandler, getUserHandler, createUserHandler, updateUserHandler, deleteUserHandler, reactivateUserHandler } from './handlers/user.handler.js';
import { changeRoleHandler } from './handlers/role.handler.js';
import { changePasswordHandler } from './handlers/password.handler.js';
import { requestPasswordResetHandler, confirmPasswordResetHandler } from './handlers/password-reset.handler.js';

export async function registerUserRoutes(app: FastifyInstance): Promise<void> {
  // Plan SC: FR-P02.2
  app.get('/users', listUsersHandler);
  app.get('/users/:id', getUserHandler);

  // Plan SC: FR-P02.1
  app.post('/users', createUserHandler);

  // Plan SC: FR-P02.3
  app.put('/users/:id', updateUserHandler);

  // Plan SC: FR-P02.4 (소프트 삭제 개선)
  app.delete('/users/:id', deleteUserHandler);

  // Plan SC: FR-P02.4 (복원)
  app.put('/users/:id/reactivate', reactivateUserHandler);

  // Plan SC: FR-P02.5
  app.put('/users/:id/role', changeRoleHandler);

  // Plan SC: FR-P02.6
  app.put('/users/:id/password', changePasswordHandler);

  // Plan SC: FR-P02.7 (비밀번호 재설정)
  app.post('/users/password-reset/request', requestPasswordResetHandler);
  app.post('/users/password-reset/confirm', confirmPasswordResetHandler);
}
