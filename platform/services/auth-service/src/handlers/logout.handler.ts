// 로그아웃 핸들러
// Design Ref: DESIGN-MTU-P01 Section 2 — POST /auth/logout
// Design Ref: SVC-AUTHR2-R50.design.md §2 (R2 Problem Details)
// Plan SC: FR-P01.4, FR-AUTHR2.1
// CSAP: D-08-03 로그아웃 시 토큰 무효화, D-12-03 표준 에러

import type { FastifyRequest, FastifyReply } from 'fastify';
import { logoutSchema } from '../schemas/login.schema.js';
import { verifyToken } from '../lib/jwt.js';
import { removeSession, blacklistToken } from '../lib/session.js';
import { logAuthEvent } from '../lib/audit.js';
import { AuthProblemTypes, problemReply } from '../lib/problem-reply.js';

/**
 * 로그아웃 핸들러
 *
 * - 갱신 토큰을 블랙리스트에 등록
 * - 세션 목록에서 제거
 * - 감사 로그 기록
 */
export async function logoutHandler(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const parseResult = logoutSchema.safeParse(request.body);
  if (!parseResult.success) {
    await problemReply(request, reply, {
      type: AuthProblemTypes.validation,
      title: '갱신 토큰을 제공하세요',
      status: 400,
    });
    return;
  }

  const { refreshToken } = parseResult.data;

  try {
    // 갱신 토큰에서 사용자 정보 추출
    const payload = await verifyToken(refreshToken);

    // 세션 제거 + 토큰 블랙리스트
    await removeSession(payload.sub, refreshToken);

    // 접근 토큰도 블랙리스트에 등록 (Authorization 헤더에서 추출)
    const authHeader = request.headers.authorization;
    if (authHeader?.startsWith('Bearer ')) {
      await blacklistToken(authHeader.slice(7));
    }

    // 감사 로그
    await logAuthEvent('LOGOUT', payload.sub, payload.tenantId, request.ip, request.headers['user-agent'] ?? 'unknown');

    await reply.status(200).send({
      success: true,
      message: '로그아웃 완료',
    });
  } catch {
    // 이미 만료된 토큰도 로그아웃 처리
    await reply.status(200).send({
      success: true,
      message: '로그아웃 완료',
    });
  }
}
