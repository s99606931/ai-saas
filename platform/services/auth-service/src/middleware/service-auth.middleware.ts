// 서비스 간 인증 미들웨어 (HMAC-SHA256)
// Design Ref: SVC-AUTH-R1 DESIGN §4
// Plan SC: FR-AUTH.4
// CSAP: D-08-01 인증 관리 — 내부 서비스 통신 인증

import type { FastifyRequest, FastifyReply } from 'fastify';
import crypto from 'node:crypto';

/** 서비스 토큰 유효 기간 (초) */
const TOKEN_MAX_AGE_SECONDS = 300; // 5분

/**
 * 내부 서비스 인증 미들웨어
 *
 * X-Service-Token 헤더를 파싱하여 HMAC-SHA256 검증을 수행합니다.
 * 헤더 형식: {serviceName}:{timestamp}:{hmac}
 * HMAC 입력: {serviceName}:{timestamp}:{requestPath}
 *
 * CSAP D-08-01: 모든 서비스 간 통신에 인증 필수
 *
 * @param request - Fastify 요청 객체
 * @param reply - Fastify 응답 객체
 */
export async function requireServiceAuth(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const serviceKey = process.env['INTERNAL_SERVICE_KEY'];
  if (!serviceKey) {
    request.log.error('INTERNAL_SERVICE_KEY 환경 변수가 설정되지 않았습니다');
    await reply.status(500).send({
      success: false,
      error: {
        code: 'SERVICE_AUTH_CONFIG_ERROR',
        message: '서비스 인증 설정 오류',
      },
    });
    return;
  }

  const tokenHeader = request.headers['x-service-token'] as string | undefined;
  if (!tokenHeader) {
    await reply.status(403).send({
      success: false,
      error: {
        code: 'SERVICE_AUTH_REQUIRED',
        message: '서비스 인증 토큰이 필요합니다',
      },
    });
    return;
  }

  // 헤더 파싱: {serviceName}:{timestamp}:{hmac}
  const parts = tokenHeader.split(':');
  if (parts.length !== 3) {
    await reply.status(403).send({
      success: false,
      error: {
        code: 'SERVICE_AUTH_INVALID_FORMAT',
        message: '서비스 토큰 형식이 올바르지 않습니다',
      },
    });
    return;
  }

  const [serviceName, timestampStr, providedHmac] = parts;

  // 타임스탬프 유효성 검증 (5분 이내)
  const timestamp = parseInt(timestampStr ?? '0', 10);
  const now = Math.floor(Date.now() / 1000);
  const age = Math.abs(now - timestamp);

  if (isNaN(timestamp) || age > TOKEN_MAX_AGE_SECONDS) {
    await reply.status(403).send({
      success: false,
      error: {
        code: 'SERVICE_AUTH_EXPIRED',
        message: '서비스 토큰이 만료되었습니다',
      },
    });
    return;
  }

  // HMAC 검증
  const urlPath = request.url.split('?')[0] ?? request.url;
  const message = `${serviceName}:${timestampStr}:${urlPath}`;
  const expectedHmac = crypto.createHmac('sha256', serviceKey).update(message).digest('hex');

  // Timing-safe 비교 (CSAP D-09: 타이밍 공격 방지)
  const isValid =
    providedHmac !== undefined &&
    providedHmac.length === expectedHmac.length &&
    crypto.timingSafeEqual(Buffer.from(providedHmac, 'utf8'), Buffer.from(expectedHmac, 'utf8'));

  if (!isValid) {
    await reply.status(403).send({
      success: false,
      error: {
        code: 'SERVICE_AUTH_INVALID',
        message: '서비스 인증에 실패했습니다',
      },
    });
    return;
  }

  // 요청에 서비스 정보 바인딩 (감사 로그용)
  (request as FastifyRequest & { serviceClient?: string }).serviceClient = serviceName ?? 'unknown';
}
