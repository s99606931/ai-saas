// 역할 변경 핸들러
// Design Ref: DESIGN-MTU-P02
// Plan SC: FR-P02.5
// CSAP: D-08-05 접근 권한

import type { FastifyRequest, FastifyReply } from 'fastify';
import { PrismaClient } from '@prisma/client';
import { z } from 'zod';
import { logUserEvent } from '../lib/audit.js';

const prisma = new PrismaClient();

const changeRoleSchema = z.object({
  role: z.enum(['TENANT_ADMIN', 'USER', 'VIEWER', 'AUDITOR']),
});

/**
 * 역할 변경 핸들러
 * SUPER_ADMIN 역할은 API로 변경 불가 (보안)
 * CSAP D-08-05: 테넌트 격리 + RBAC 검사
 * CSAP D-06: 실제 actor ID 감사 로그 기록
 */
export async function changeRoleHandler(
  request: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply,
): Promise<void> {
  const parseResult = changeRoleSchema.safeParse(request.body);
  if (!parseResult.success) {
    await reply.status(400).send({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: '유효한 역할을 선택하세요' },
    });
    return;
  }

  // CSAP D-08-05: 테넌트 격리 — 대상 사용자 확인
  const targetUser = await prisma.user.findUnique({
    where: { id: request.params.id },
    select: { id: true, tenantId: true, role: true },
  });

  if (!targetUser) {
    await reply.status(404).send({
      success: false,
      error: { code: 'USER_NOT_FOUND', message: '사용자를 찾을 수 없습니다' },
    });
    return;
  }

  const jwtTenantId = request.headers['x-user-tenant-id'] as string | undefined;
  const jwtRole = request.headers['x-user-role'] as string | undefined;

  // SUPER_ADMIN 제외 타 테넌트 사용자 역할 변경 금지 (CSAP D-08-05)
  if (jwtRole !== 'SUPER_ADMIN' && jwtTenantId && targetUser.tenantId !== jwtTenantId) {
    await reply.status(403).send({
      success: false,
      error: { code: 'FORBIDDEN', message: '접근 권한이 없습니다' },
    });
    return;
  }

  const user = await prisma.user.update({
    where: { id: request.params.id },
    data: { role: parseResult.data.role },
    select: { id: true, email: true, name: true, role: true, tenantId: true },
  });

  // 감사 로그 기록 (FR-P02.10, CSAP D-06)
  // 게이트웨이가 주입한 x-user-id 헤더에서 실제 actor ID 추출
  const actor = (request.headers['x-user-id'] as string) || 'system';
  await logUserEvent(
    'USER_ROLE_CHANGED',
    actor,
    request.params.id,
    user.tenantId,
    request.ip,
    request.headers['user-agent'] ?? 'unknown',
    { previousRole: targetUser.role, newRole: parseResult.data.role },
  );

  await reply.send({ success: true, data: user });
}
