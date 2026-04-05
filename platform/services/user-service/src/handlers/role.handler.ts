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

  const user = await prisma.user.update({
    where: { id: request.params.id },
    data: { role: parseResult.data.role },
    select: { id: true, email: true, name: true, role: true },
  });

  // 감사 로그 기록 (FR-P02.10, CSAP D-06)
  await logUserEvent(
    'USER_ROLE_CHANGED',
    'system', // TODO: request.user.sub when auth middleware applied
    request.params.id,
    user.role,
    request.ip,
    request.headers['user-agent'] ?? 'unknown',
    { newRole: parseResult.data.role },
  );

  await reply.send({ success: true, data: user });
}
