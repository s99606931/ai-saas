// 비밀번호 변경 핸들러
// Design Ref: DESIGN-MTU-P02
// Plan SC: FR-P02.6
// CSAP: D-08-07 비밀번호 정책

import type { FastifyRequest, FastifyReply } from 'fastify';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';
import { z } from 'zod';
import { AUTH_CONSTANTS } from '@public-saas/auth-sdk';
import { logUserEvent } from '../lib/audit.js';

const prisma = new PrismaClient();

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

  const newHash = await bcrypt.hash(newPassword, AUTH_CONSTANTS.BCRYPT_SALT_ROUNDS);

  await prisma.user.update({
    where: { id: request.params.id },
    data: { passwordHash: newHash },
  });

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

  // NOTE: 비밀번호 변경 후 기존 세션 무효화는 auth-service Redis 연동 필요
  // 현재 아키텍처에서는 API 게이트웨이가 토큰 만료 시 자연 무효화 처리
  // Phase P4에서 auth-service 간 이벤트 기반 세션 무효화 구현 예정

  await reply.send({ success: true, message: '비밀번호가 변경되었습니다' });
}
