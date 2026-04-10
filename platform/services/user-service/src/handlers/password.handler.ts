// 비밀번호 변경 핸들러
// Design Ref: DESIGN-MTU-P02, SVC-USER-R1 DESIGN §4, §5
// Plan SC: FR-P02.6, FR-USR.4, FR-USR.5
// CSAP: D-08-07 비밀번호 정책, D-08-07 비밀번호 재사용 방지

import type { FastifyRequest, FastifyReply } from 'fastify';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { AUTH_CONSTANTS } from '@public-saas/auth-sdk';
import { logUserEvent } from '../lib/audit.js';
import { prisma } from '../lib/prisma.js';
import { generateServiceToken } from '../lib/service-auth.js';
import { isPasswordReused, addPasswordHistory } from '../lib/password-history.js';

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, '현재 비밀번호를 입력하세요'),
  newPassword: z.string().min(8, '새 비밀번호는 8자 이상이어야 합니다'),
});

/**
 * 비밀번호 변경 핸들러
 * CSAP D-08-07: 현재 비밀번호 확인 + 정책 검증
 * CSAP D-08-05: 테넌트 격리 — 본인 또는 관리자만 변경 가능
 */
export async function changePasswordHandler(
  request: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply,
): Promise<void> {
  const parseResult = changePasswordSchema.safeParse(request.body);
  if (!parseResult.success) {
    await reply.status(400).send({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: parseResult.error.issues.map((i) => i.message).join(', ') },
    });
    return;
  }

  const { currentPassword, newPassword } = parseResult.data;

  // 현재 비밀번호 확인
  const user = await prisma.user.findUnique({
    where: { id: request.params.id },
    select: { id: true, passwordHash: true, tenantId: true },
  });

  if (!user) {
    await reply.status(404).send({
      success: false,
      error: { code: 'USER_NOT_FOUND', message: '사용자를 찾을 수 없습니다' },
    });
    return;
  }

  // CSAP D-08-05: 테넌트 격리 + 본인 확인
  const jwtUserId = request.headers['x-user-id'] as string | undefined;
  const jwtTenantId = request.headers['x-user-tenant-id'] as string | undefined;
  const jwtRole = request.headers['x-user-role'] as string | undefined;
  const isSelf = jwtUserId === request.params.id;
  const isSuperAdmin = jwtRole === 'SUPER_ADMIN';

  // 본인이 아니고 슈퍼관리자도 아닌 경우 차단
  if (!isSelf && !isSuperAdmin) {
    await reply.status(403).send({
      success: false,
      error: { code: 'FORBIDDEN', message: '본인의 비밀번호만 변경할 수 있습니다' },
    });
    return;
  }

  // SUPER_ADMIN 제외 타 테넌트 사용자 비밀번호 변경 금지
  if (!isSuperAdmin && jwtTenantId && user.tenantId !== jwtTenantId) {
    await reply.status(403).send({
      success: false,
      error: { code: 'FORBIDDEN', message: '접근 권한이 없습니다' },
    });
    return;
  }

  const isCurrentValid = await bcrypt.compare(currentPassword, user.passwordHash);
  if (!isCurrentValid) {
    await reply.status(401).send({
      success: false,
      error: { code: 'WRONG_PASSWORD', message: '현재 비밀번호가 올바르지 않습니다' },
    });
    return;
  }

  // 새 비밀번호 정책 검증
  if (!AUTH_CONSTANTS.PASSWORD_REGEX.test(newPassword)) {
    await reply.status(400).send({
      success: false,
      error: { code: 'PASSWORD_POLICY', message: '비밀번호는 대문자, 소문자, 숫자, 특수문자를 포함해야 합니다' },
    });
    return;
  }

  // FR-USR.5: 비밀번호 재사용 방지 (Design Ref: SVC-USER-R1 DESIGN §5)
  const reused = await isPasswordReused(request.params.id, newPassword);
  if (reused) {
    await reply.status(400).send({
      success: false,
      error: {
        code: 'PASSWORD_REUSED',
        message: '최근 사용한 비밀번호는 재사용할 수 없습니다 (CSAP D-08-07)',
      },
    });
    return;
  }

  const newHash = await bcrypt.hash(newPassword, AUTH_CONSTANTS.BCRYPT_SALT_ROUNDS);

  await prisma.user.update({
    where: { id: request.params.id },
    data: { passwordHash: newHash },
  });

  // FR-USR.5: 비밀번호 이력 추가 (Design Ref: SVC-USER-R1 DESIGN §5)
  addPasswordHistory(request.params.id, newHash);

  // 감사 로그 기록 (FR-P02.10, CSAP D-06)
  const actor = jwtUserId ?? request.params.id;
  await logUserEvent(
    'USER_PASSWORD_CHANGED',
    actor,
    request.params.id,
    user.tenantId,
    request.ip,
    request.headers['user-agent'] ?? 'unknown',
  );

  // CSAP D-08-03: 비밀번호 변경 후 기존 세션 전체 무효화
  // FR-USR.4: HMAC-SHA256 서비스 인증 토큰 첨부 (Design Ref: SVC-USER-R1 DESIGN §4)
  const authServiceUrl = process.env['AUTH_SERVICE_URL'] ?? 'http://localhost:3001';
  try {
    const serviceToken = generateServiceToken('user-service');
    await fetch(`${authServiceUrl}/auth/sessions/invalidate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(serviceToken ? { 'X-Service-Token': serviceToken } : {}),
      },
      body: JSON.stringify({
        userId: request.params.id,
        tenantId: user.tenantId,
        reason: 'PASSWORD_CHANGED',
      }),
      signal: AbortSignal.timeout(10000), // CSAP D-07: 서비스 간 통신 타임아웃 10초
    });
  } catch {
    // 세션 무효화 실패 시에도 비밀번호 변경은 성공 (가용성 우선)
    // 토큰 자연 만료로 최종 정합성 보장
  }

  await reply.send({ success: true, message: '비밀번호가 변경되었습니다' });
}
