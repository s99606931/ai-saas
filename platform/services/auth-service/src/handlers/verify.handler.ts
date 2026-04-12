// 토큰 검증 핸들러
// Design Ref: DESIGN-MTU-P01 Section 2 — GET /auth/verify
// Design Ref: SVC-AUTHR2-R50.design.md §2 (R2 Problem Details)
// Plan SC: FR-P01.2, FR-AUTHR2.1

import type { FastifyRequest, FastifyReply } from 'fastify';
import { verifyToken } from '../lib/jwt.js';
import { isTokenBlacklisted } from '../lib/session.js';
import { AuthProblemTypes, problemReply } from '../lib/problem-reply.js';

/**
 * 토큰 검증 핸들러
 *
 * Authorization 헤더의 Bearer 토큰을 검증하고 페이로드를 반환합니다.
 */
export async function verifyHandler(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const authHeader = request.headers.authorization;

  if (!authHeader?.startsWith('Bearer ')) {
    await problemReply(request, reply, {
      type: AuthProblemTypes.noToken,
      title: '인증 토큰이 제공되지 않았습니다',
      status: 401,
    });
    return;
  }

  const token = authHeader.slice(7);

  try {
    // 블랙리스트 확인
    if (await isTokenBlacklisted(token)) {
      await problemReply(request, reply, {
        type: AuthProblemTypes.tokenRevoked,
        title: '토큰이 무효화되었습니다',
        status: 401,
      });
      return;
    }

    // 토큰 검증
    const payload = await verifyToken(token);

    await reply.status(200).send({
      success: true,
      data: payload,
    });
  } catch {
    await problemReply(request, reply, {
      type: AuthProblemTypes.tokenInvalid,
      title: '유효하지 않거나 만료된 토큰입니다',
      status: 401,
    });
  }
}
