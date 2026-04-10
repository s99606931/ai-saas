// 토큰 검증 핸들러
// Design Ref: DESIGN-MTU-P01 Section 2 — GET /auth/verify
// Plan SC: FR-P01.2

import type { FastifyRequest, FastifyReply } from 'fastify';
import { verifyToken } from '../lib/jwt.js';
import { isTokenBlacklisted } from '../lib/session.js';

/**
 * 토큰 검증 핸들러
 *
 * Authorization 헤더의 Bearer 토큰을 검증하고 페이로드를 반환합니다.
 */
export async function verifyHandler(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const authHeader = request.headers.authorization;

  if (!authHeader?.startsWith('Bearer ')) {
    await reply.status(401).send({
      success: false,
      error: { code: 'AUTH_NO_TOKEN', message: '인증 토큰이 제공되지 않았습니다' },
    });
    return;
  }

  const token = authHeader.slice(7);

  try {
    // 블랙리스트 확인
    if (await isTokenBlacklisted(token)) {
      await reply.status(401).send({
        success: false,
        error: { code: 'AUTH_TOKEN_REVOKED', message: '토큰이 무효화되었습니다' },
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
    await reply.status(401).send({
      success: false,
      error: { code: 'AUTH_TOKEN_INVALID', message: '유효하지 않거나 만료된 토큰입니다' },
    });
  }
}
