// 인증 이벤트 감사 로그
// Design Ref: DESIGN-MTU-P01
// Plan SC: FR-P01.12
// CSAP: D-06-01 침해사고 관리

import { createAuditLogger, createStandardTransport } from '@public-saas/audit-sdk';

// 감사 로거 인스턴스 (서비스 수준)
const auditLogger = createAuditLogger({
  serviceName: 'auth-service',
  transport: createStandardTransport('auth-service'),
});

/**
 * 인증 이벤트 감사 로그 기록
 *
 * @param action - 행위 (LOGIN_SUCCESS, LOGIN_FAIL, LOGOUT, TOKEN_REFRESH 등)
 * @param actor - 행위자 ID
 * @param tenantId - 테넌트 ID
 * @param ip - 클라이언트 IP
 * @param userAgent - User-Agent
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
    ip,
    userAgent,
    metadata,
  });
}
