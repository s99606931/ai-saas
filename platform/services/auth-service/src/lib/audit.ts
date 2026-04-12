// 인증 이벤트 감사 로그
// Design Ref: DESIGN-MTU-P01
// Design Ref: SVC-AUTHR2-R50.design.md §3.2 (UA/IP 위생화)
// Plan SC: FR-P01.12, FR-AUTHR2.4
// CSAP: D-06-01 침해사고 관리, D-06 로그 인젝션 방어

import { createAuditLogger, createStandardTransport } from '@public-saas/audit-sdk';
import { stripControlChars, truncate } from '@public-saas/input-sanitizer';

// 감사 로거 인스턴스 (서비스 수준)
const auditLogger = createAuditLogger({
  serviceName: 'auth-service',
  transport: createStandardTransport('auth-service'),
});

/**
 * User-Agent 위생화 (로그 인젝션 방어)
 * Design Ref: SVC-AUTHR2-R50.design.md §3.2
 * Plan SC: FR-AUTHR2.4
 */
export function sanitizeUserAgent(ua: string | undefined): string {
  if (!ua || typeof ua !== 'string') return 'unknown';
  const cleaned = stripControlChars(ua);
  if (cleaned.length === 0) return 'unknown';
  return truncate(cleaned, 500);
}

/**
 * IP 주소 유효성 검증 (형식 기반)
 * Design Ref: SVC-AUTHR2-R50.design.md §3.2
 * Plan SC: FR-AUTHR2.4
 */
export function sanitizeIp(ip: string | undefined): string {
  if (!ip || typeof ip !== 'string') return 'unknown';
  // IPv4/IPv6/혼합 허용 문자 세트: [0-9a-fA-F:.]
  if (!/^[0-9a-fA-F:.]{3,45}$/.test(ip)) return 'unknown';
  return ip;
}

/**
 * 인증 이벤트 감사 로그 기록
 *
 * @param action - 행위 (LOGIN_SUCCESS, LOGIN_FAIL, LOGOUT, TOKEN_REFRESH 등)
 * @param actor - 행위자 ID
 * @param tenantId - 테넌트 ID
 * @param ip - 클라이언트 IP (위생화 적용)
 * @param userAgent - User-Agent (위생화 적용)
 * @param metadata - 추가 메타데이터
 */
export async function logAuthEvent(
  action: string,
  actor: string,
  tenantId: string,
  ip: string,
  userAgent: string,
  metadata?: Record<string, unknown>,
): Promise<void> {
  await auditLogger.log({
    actor,
    action,
    target: actor,
    targetType: 'session',
    tenantId,
    ip: sanitizeIp(ip),
    userAgent: sanitizeUserAgent(userAgent),
    metadata,
  });
}
