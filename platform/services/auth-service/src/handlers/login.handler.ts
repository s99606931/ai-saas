// 로그인 핸들러
// Design Ref: DESIGN-MTU-P01 Section 2 — POST /auth/login
// Design Ref: SVC-AUTHR2-R50.design.md §2, §3.1 (R2 Problem Details + Email 정규화)
// Plan SC: FR-P01.1, FR-P01.6, FR-P01.8, FR-P01.12, FR-AUTHR2.1, FR-AUTHR2.3, FR-AUTHR2.6
// CSAP: D-08-01 인증, D-08-06 계정 잠금, D-12-01 입력 검증, D-12-03 표준 에러

import type { FastifyRequest, FastifyReply } from 'fastify';
import { loginSchema } from '../schemas/login.schema.js';
import { verifyPassword } from '../lib/password.js';
import { signAccessToken, signRefreshToken } from '../lib/jwt.js';
import { createSession } from '../lib/session.js';
import { logAuthEvent } from '../lib/audit.js';
import { prisma } from '../lib/prisma.js';
import { AUTH_CONSTANTS } from '@public-saas/auth-sdk';
import { getUserPermissions } from '../lib/permissions.js';
import { verifyTotp } from '../lib/totp.js';
import { decryptMfaSecret } from '../lib/mfa-crypto.js';
import { stripControlChars, truncate } from '@public-saas/input-sanitizer';
import { AuthProblemTypes, problemReply } from '../lib/problem-reply.js';

/**
 * 이메일 입력 정규화
 * Design Ref: SVC-AUTHR2-R50.design.md §3.1
 * Plan SC: FR-AUTHR2.3
 */
function normalizeEmail(raw: string): string {
  // RFC 5321: 이메일 최대 320자
  return truncate(stripControlChars(raw), 320).trim().toLowerCase();
}

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
export async function loginHandler(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  // 1. 입력 검증
  const parseResult = loginSchema.safeParse(request.body);
  if (!parseResult.success) {
    await problemReply(request, reply, {
      type: AuthProblemTypes.validation,
      title: '입력 값이 유효하지 않습니다',
      status: 400,
      detail: parseResult.error.issues.map((i) => i.message).join(', '),
    });
    return;
  }

  // Plan SC: FR-AUTHR2.3 -- 이메일 정규화 (제어문자 제거 + trim + lowercase)
  const email = normalizeEmail(parseResult.data.email);
  const { password, tenantSlug } = parseResult.data;
  const ip = request.ip;
  const userAgent = request.headers['user-agent'] ?? 'unknown';

  // 2. 테넌트 확인
  const tenant = await prisma.tenant.findUnique({
    where: { slug: tenantSlug },
  });

  if (!tenant || tenant.status !== 'ACTIVE') {
    await problemReply(request, reply, {
      type: AuthProblemTypes.tenantNotFound,
      title: '테넌트를 찾을 수 없습니다',
      status: 401,
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
    await problemReply(request, reply, {
      type: AuthProblemTypes.invalidCredentials,
      title: '이메일 또는 비밀번호가 올바르지 않습니다',
      status: 401,
    });
    return;
  }

  // 4. 계정 잠금 확인 (CSAP D-08-06)
  if (user.lockedUntil && user.lockedUntil > new Date()) {
    await logAuthEvent('LOGIN_FAIL_ACCOUNT_LOCKED', user.id, tenant.id, ip, userAgent);
    await problemReply(request, reply, {
      type: AuthProblemTypes.accountLocked,
      title: '계정이 잠겨 있습니다',
      status: 423,
      detail: `${user.lockedUntil.toISOString()} 이후 다시 시도하세요`,
      extensions: {
        lockedUntil: user.lockedUntil.toISOString(),
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
      updateData['lockedUntil'] = new Date(Date.now() + AUTH_CONSTANTS.ACCOUNT_LOCK_DURATION_SECONDS * 1000);
    }

    await prisma.user.update({
      where: { id: user.id },
      data: updateData,
    });

    await logAuthEvent('LOGIN_FAIL_WRONG_PASSWORD', user.id, tenant.id, ip, userAgent, {
      failedAttempts: newFailedCount,
    });

    await problemReply(request, reply, {
      type: AuthProblemTypes.invalidCredentials,
      title: '이메일 또는 비밀번호가 올바르지 않습니다',
      status: 401,
    });
    return;
  }

  // 7. MFA 검증 (CSAP D-08-08: 다중 인증)
  // Design Ref: SVC-AUTH-R1 DESIGN §1.1
  if (user.mfaEnabled && user.mfaSecret) {
    const { mfaCode } = parseResult.data;

    if (!mfaCode) {
      // MFA 활성 사용자가 코드를 제공하지 않은 경우
      await logAuthEvent('LOGIN_MFA_REQUIRED', user.id, tenant.id, ip, userAgent);
      await problemReply(request, reply, {
        type: AuthProblemTypes.mfaRequired,
        title: 'MFA 인증 코드가 필요합니다',
        status: 403,
      });
      return;
    }

    // 저장된 암호화 시크릿 복호화 후 TOTP 검증
    const decryptedSecret = decryptMfaSecret(user.mfaSecret);
    const isMfaValid = verifyTotp(decryptedSecret, mfaCode);

    if (!isMfaValid) {
      await logAuthEvent('LOGIN_FAIL_MFA_INVALID', user.id, tenant.id, ip, userAgent);
      await problemReply(request, reply, {
        type: AuthProblemTypes.mfaInvalid,
        title: 'MFA 인증 코드가 올바르지 않습니다',
        status: 401,
      });
      return;
    }
  }

  // 8. JWT 발급
  const permissions = await getUserPermissions(user.role);

  const accessToken = await signAccessToken({
    sub: user.id,
    tenantId: tenant.id,
    role: user.role.toLowerCase() as 'super_admin' | 'tenant_admin' | 'user' | 'viewer' | 'auditor',
    permissions,
  });

  const refreshToken = await signRefreshToken(user.id, tenant.id);

  // 9. 세션 생성 (CSAP D-08-04: 최대 3개)
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

  // 10. 감사 로그
  await logAuthEvent('LOGIN_SUCCESS', user.id, tenant.id, ip, userAgent);

  // FR-L03.1: HttpOnly 쿠키로 토큰 전송 (CSAP D-08-04, OWASP A07:2021)
  // Design Ref: L-03-HTTPONLY-COOKIE.design.md §1
  const isProduction = process.env['NODE_ENV'] === 'production';
  void reply.header('Set-Cookie', [
    `accessToken=${accessToken}; HttpOnly; ${isProduction ? 'Secure; ' : ''}SameSite=Strict; Path=/; Max-Age=${AUTH_CONSTANTS.ACCESS_TOKEN_EXPIRES_SECONDS}`,
    `refreshToken=${refreshToken}; HttpOnly; ${isProduction ? 'Secure; ' : ''}SameSite=Strict; Path=/auth/refresh; Max-Age=${AUTH_CONSTANTS.REFRESH_TOKEN_EXPIRES_SECONDS}`,
  ]);

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
