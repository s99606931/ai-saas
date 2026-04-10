// 서비스 간 HMAC-SHA256 인증 토큰 생성
// Design Ref: SVC-USER-R1 DESIGN §4
// Plan SC: FR-USR.4
// CSAP: D-08 접근 통제 — 내부 API 위장 호출 방지

import { createHmac } from 'node:crypto';

/** 서비스 인증 시크릿 (환경 변수) */
const SERVICE_AUTH_SECRET = process.env['SERVICE_AUTH_SECRET'] ?? '';

/**
 * HMAC-SHA256 서비스 인증 토큰 생성
 *
 * auth-service service-auth.middleware.ts의 검증 로직과 호환됩니다.
 * 토큰 형식: `{serviceName}:{timestamp}:{hmac}`
 * 유효 기간: 5분 (auth-service 측에서 검증)
 *
 * @param serviceName - 호출 서비스명 (예: 'user-service')
 * @returns X-Service-Token 헤더 값
 */
export function generateServiceToken(serviceName: string = 'user-service'): string {
  if (!SERVICE_AUTH_SECRET) {
    // 시크릿 미설정 시 빈 토큰 반환 (개발 환경 호환)
    return '';
  }

  const timestamp = Date.now().toString();
  const hmac = createHmac('sha256', SERVICE_AUTH_SECRET).update(`${serviceName}:${timestamp}`).digest('hex');

  return `${serviceName}:${timestamp}:${hmac}`;
}
