// 비밀번호 변경 핸들러
// Design Ref: SVC-AUTH-R1 DESIGN §2
// Plan SC: FR-AUTH.2
// CSAP: D-08-07 비밀번호 정책, D-08-03 비밀번호 변경 시 세션 무효화

import type { FastifyRequest, FastifyReply } from 'fastify';
import { passwordChangeSchema } from '../schemas/password.schema.js';
import { verifyPassword, hashPassword, validatePasswordPolicy } from '../lib/password.js';
import { logAuthEvent } from '../lib/audit.js';
import { prisma } from '../lib/prisma.js';
import { redis, blacklistToken } from '../lib/session.js';

interface SessionData {
  token: string;
  refreshToken: string;
  ip: string;
  userAgent: string;
  createdAt: string;
}

/**
 * 비밀번호 변경 핸들러
 *
 * POST /auth/password/change
 *
 * 흐름:
 * 1. 인증 확인 (request.user)
 * 2. 입력 검증 (Zod)
 * 3. 현재 비밀번호 검증
 * 4. 새 비밀번호 정책 검증 (CSAP D-08-07)
 * 5. 현재/새 비밀번호 동일 여부 확인
 * 6. 비밀번호 해시 업데이트
 * 7. 모든 기존 세션 무효화 (CSAP D-08-03)
 * 8. 감사 로그 기록 (CSAP D-06)
 */
export async function passwordChangeHandler(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  // 1. 인증 확인
  const user = (request as FastifyRequest & { user?: { sub: string; tenantId: string } }).user;
  if (!user) {
    await reply.status(401).send({
      success: false,
      error: { code: 'AUTH_REQUIRED', message: '인증이 필요합니다' },
    });
    return;
  }

  // 2. 입력 검증 (CSAP D-12)
  const parseResult = passwordChangeSchema.safeParse(request.body);
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

  const { currentPassword, newPassword } = parseResult.data;

  // DB에서 사용자 조회
  const dbUser = await prisma.user.findUnique({
    where: { id: user.sub },
    select: { id: true, passwordHash: true, tenantId: true },
  });

  if (!dbUser) {
    await reply.status(404).send({
      success: false,
      error: { code: 'USER_NOT_FOUND', message: '사용자를 찾을 수 없습니다' },
    });
    return;
  }

  // 3. 현재 비밀번호 검증
  const isValid = await verifyPassword(currentPassword, dbUser.passwordHash);
  if (!isValid) {
    await logAuthEvent(
      'PASSWORD_CHANGE_FAIL_WRONG_CURRENT',
      user.sub,
      dbUser.tenantId,
      request.ip,
      request.headers['user-agent'] ?? 'unknown',
    );
    await reply.status(401).send({
      success: false,
      error: { code: 'WRONG_PASSWORD', message: '현재 비밀번호가 올바르지 않습니다' },
    });
    return;
  }

  // 4. 새 비밀번호 정책 검증 (CSAP D-08-07)
  const policyError = validatePasswordPolicy(newPassword);
  if (policyError) {
    await reply.status(400).send({
      success: false,
      error: { code: 'PASSWORD_POLICY_VIOLATION', message: policyError },
    });
    return;
  }

  // 5. 현재/새 비밀번호 동일 여부 확인
  const isSame = await verifyPassword(newPassword, dbUser.passwordHash);
  if (isSame) {
    await reply.status(400).send({
      success: false,
      error: {
        code: 'PASSWORD_SAME',
        message: '새 비밀번호는 현재 비밀번호와 달라야 합니다',
      },
    });
    return;
  }

  // 6. 비밀번호 해시 업데이트
  const newHash = await hashPassword(newPassword);
  await prisma.user.update({
    where: { id: user.sub },
    data: { passwordHash: newHash },
  });

  // 7. 모든 기존 세션 무효화 (CSAP D-08-03)
  const sessionKey = `sessions:${user.sub}`;
  const sessions = await redis.lrange(sessionKey, 0, -1);

  for (const raw of sessions) {
    try {
      const session = JSON.parse(raw) as SessionData;
      await blacklistToken(session.token);
      if (session.refreshToken) {
        await blacklistToken(session.refreshToken);
      }
    } catch {
      // 개별 세션 파싱 실패 시 건너뜀
    }
  }
  await redis.del(sessionKey);

  // 8. 감사 로그 (CSAP D-06)
  await logAuthEvent(
    'PASSWORD_CHANGED',
    user.sub,
    dbUser.tenantId,
    request.ip,
    request.headers['user-agent'] ?? 'unknown',
    { sessionsInvalidated: sessions.length },
  );

  await reply.status(200).send({
    success: true,
    message: '비밀번호가 변경되었습니다. 모든 기존 세션이 무효화되었습니다.',
  });
}
