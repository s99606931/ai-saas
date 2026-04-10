// 세션 전체 무효화 핸들러 (서비스 간 내부 통신)
// Design Ref: DESIGN-MTU-P01 Section 4 — 비밀번호 변경 시 세션 무효화
// Plan SC: FR-P01.4 보완
// CSAP: D-08-03 비밀번호 변경 시 기존 세션 전체 무효화

import type { FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { redis, blacklistToken } from '../lib/session.js';
import { logAuthEvent } from '../lib/audit.js';

const invalidateSchema = z.object({
  userId: z.string().min(1, '사용자 ID는 필수입니다'),
  tenantId: z.string().min(1, '테넌트 ID는 필수입니다'),
  reason: z.enum(['PASSWORD_CHANGED', 'ACCOUNT_LOCKED', 'ADMIN_FORCE_LOGOUT']),
});

interface SessionData {
  token: string;
  refreshToken: string;
  ip: string;
  userAgent: string;
  createdAt: string;
}

/**
 * 특정 사용자의 모든 세션 무효화
 *
 * 비밀번호 변경, 계정 잠금 등의 보안 이벤트 발생 시
 * user-service, security-monitor-service 등에서 호출.
 *
 * 내부 서비스 전용 API (API 게이트웨이에서 외부 노출 차단 권장)
 */
export async function invalidateAllSessionsHandler(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const parseResult = invalidateSchema.safeParse(request.body);
  if (!parseResult.success) {
    await reply.status(400).send({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: parseResult.error.issues.map((i) => i.message).join(', ') },
    });
    return;
  }

  const { userId, tenantId, reason } = parseResult.data;
  const sessionKey = `sessions:${userId}`;

  // 해당 사용자의 모든 세션 조회
  const sessions = await redis.lrange(sessionKey, 0, -1);
  let invalidatedCount = 0;

  for (const raw of sessions) {
    try {
      const session = JSON.parse(raw) as SessionData;
      // 접근 토큰 + 갱신 토큰 모두 블랙리스트 등록
      await blacklistToken(session.token);
      if (session.refreshToken) {
        await blacklistToken(session.refreshToken);
      }
      invalidatedCount++;
    } catch {
      // 개별 세션 파싱 실패 시 건너뜀 (무결성 깨진 세션)
    }
  }

  // 세션 목록 전체 삭제
  await redis.del(sessionKey);

  // 감사 로그 — CSAP D-06: 실제 tenantId 사용 (하드코딩 제거)
  await logAuthEvent(
    'SESSION_INVALIDATE_ALL',
    userId,
    tenantId,
    request.ip,
    request.headers['user-agent'] ?? 'internal-service',
    { reason, invalidatedCount },
  );

  await reply.send({
    success: true,
    invalidatedCount,
    message: `${invalidatedCount}개 세션이 무효화되었습니다`,
  });
}
