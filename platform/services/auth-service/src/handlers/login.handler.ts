// 로그인 핸들러
// Design Ref: DESIGN-MTU-P01 Section 2 — POST /auth/login
// Plan SC: FR-P01.1, FR-P01.6, FR-P01.8, FR-P01.12
// CSAP: D-08-01 인증, D-08-06 계정 잠금

import type { FastifyRequest, FastifyReply } from 'fastify';
import { PrismaClient } from '@prisma/client';
import { loginSchema } from '../schemas/login.schema.js';
import { verifyPassword } from '../lib/password.js';
import { signAccessToken, signRefreshToken } from '../lib/jwt.js';
import { createSession } from '../lib/session.js';
import { logAuthEvent } from '../lib/audit.js';
import { AUTH_CONSTANTS } from '@public-saas/auth-sdk';

const prisma = new PrismaClient();

/**
 * 로그인 핸들러
 *
 * 흐름:
 * 1. 입력 검증 (Zod)
 * 2. 테넌트 확인 (slug → id)
 * 3. 사용자 확인 (email + tenantId)
 * 4. 계정 잠금 확인 (CSAP D-08-06)
 * 5. 비밀번호 검증 (bcrypt)
 * 6. 로그인 실패 처리 (5회 → 30분 잠금)
 * 7. JWT 발급 (접근 15분 + 갱신 7일)
 * 8. 세션 생성 (Redis, 최대 3개)
 * 9. 감사 로그 기록 (CSAP D-06)
 */
export async function loginHandler(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  // 1. 입력 검증
  const parseResult = loginSchema.safeParse(request.body);
  if (!parseResult.success) {
    await reply.status(400).send({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: parseResult.error.issues.map((i) => i.message).join(', '),
      },
    });
    return;
  }

  const { email, password, tenantSlug } = parseResult.data;
  const ip = request.ip;
  const userAgent = request.headers['user-agent'] ?? 'unknown';

  // 2. 테넌트 확인
  const tenant = await prisma.tenant.findUnique({
    where: { slug: tenantSlug },
  });

  if (!tenant || tenant.status !== 'ACTIVE') {
    await reply.status(401).send({
      success: false,
      error: { code: 'AUTH_TENANT_NOT_FOUND', message: '테넌트를 찾을 수 없습니다' },
    });
    return;
  }

  // 3. 사용자 확인
  const user = await prisma.user.findUnique({
    where: { tenantId_email: { tenantId: tenant.id, email } },
  });

  if (!user) {
    // 감사 로그: 존재하지 않는 사용자 로그인 시도
    await logAuthEvent('LOGIN_FAIL_USER_NOT_FOUND', email, tenant.id, ip, userAgent);
    await reply.status(401).send({
      success: false,
      error: { code: 'AUTH_INVALID_CREDENTIALS', message: '이메일 또는 비밀번호가 올바르지 않습니다' },
    });
    return;
  }

  // 4. 계정 잠금 확인 (CSAP D-08-06)
  if (user.lockedUntil && user.lockedUntil > new Date()) {
    await logAuthEvent('LOGIN_FAIL_ACCOUNT_LOCKED', user.id, tenant.id, ip, userAgent);
    await reply.status(423).send({
      success: false,
      error: {
        code: 'AUTH_ACCOUNT_LOCKED',
        message: `계정이 잠겨 있습니다. ${user.lockedUntil.toISOString()} 이후 다시 시도하세요`,
      },
    });
    return;
  }

  // 5. 비밀번호 검증
  const isValid = await verifyPassword(password, user.passwordHash);

  if (!isValid) {
    // 6. 로그인 실패 처리
    const newFailedCount = user.failedLogins + 1;
    const updateData: Record<string, unknown> = { failedLogins: newFailedCount };

    // 5회 실패 → 30분 잠금 (CSAP D-08-06)
    if (newFailedCount >= AUTH_CONSTANTS.MAX_LOGIN_ATTEMPTS) {
      updateData['lockedUntil'] = new Date(
        Date.now() + AUTH_CONSTANTS.ACCOUNT_LOCK_DURATION_SECONDS * 1000,
      );
    }

    await prisma.user.update({
      where: { id: user.id },
      data: updateData,
    });

    await logAuthEvent('LOGIN_FAIL_WRONG_PASSWORD', user.id, tenant.id, ip, userAgent, {
      failedAttempts: newFailedCount,
    });

    await reply.status(401).send({
      success: false,
      error: { code: 'AUTH_INVALID_CREDENTIALS', message: '이메일 또는 비밀번호가 올바르지 않습니다' },
    });
    return;
  }

  // 7. JWT 발급
  const permissions = await getUserPermissions(user.role);

  const accessToken = await signAccessToken({
    sub: user.id,
    tenantId: tenant.id,
    role: user.role.toLowerCase() as 'super_admin' | 'tenant_admin' | 'user' | 'viewer' | 'auditor',
    permissions,
  });

  const refreshToken = await signRefreshToken(user.id, tenant.id);

  // 8. 세션 생성 (CSAP D-08-04: 최대 3개)
  await createSession(user.id, {
    token: accessToken,
    refreshToken,
    ip,
    userAgent,
    createdAt: new Date().toISOString(),
  });

  // 로그인 성공: 실패 카운터 초기화
  await prisma.user.update({
    where: { id: user.id },
    data: {
      failedLogins: 0,
      lockedUntil: null,
      lastLoginAt: new Date(),
    },
  });

  // 9. 감사 로그
  await logAuthEvent('LOGIN_SUCCESS', user.id, tenant.id, ip, userAgent);

  await reply.status(200).send({
    success: true,
    data: {
      accessToken,
      refreshToken,
      expiresIn: AUTH_CONSTANTS.ACCESS_TOKEN_EXPIRES_SECONDS,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        tenantId: tenant.id,
      },
    },
  });
}

/**
 * 역할별 권한 조회
 * Design Ref: DESIGN-MTU-P01 Section 5 RBAC
 */
async function getUserPermissions(role: string): Promise<string[]> {
  const rolePermissions = await prisma.rolePermission.findMany({
    where: { role: role as 'SUPER_ADMIN' | 'TENANT_ADMIN' | 'USER' | 'VIEWER' | 'AUDITOR' },
    include: { permission: true },
  });

  return rolePermissions.map((rp) => rp.permission.name);
}
