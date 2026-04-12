// 빌링 서비스 감사 로그
// Design Ref: DESIGN-MTU-P08, SVC-BILLR2-R55.design.md §5
// Plan SC: FR-P08.5, FR-BILLR2.4
// CSAP: D-06-01, D-12 (입력 검증)

import { createServiceAuditLogger } from '@public-saas/audit-sdk';

/**
 * User-Agent sanitize: 제어문자 제거 + 500자 절단
 * Plan SC: FR-BILLR2.4
 */
export function sanitizeUserAgent(ua: string | undefined | null): string {
  if (!ua || typeof ua !== 'string') return 'unknown';
  // eslint-disable-next-line no-control-regex
  const stripped = ua.replace(/[\u0000-\u001f\u007f]/g, '');
  if (stripped.length === 0) return 'unknown';
  return stripped.length > 500 ? stripped.slice(0, 500) : stripped;
}

/**
 * IP sanitize: IPv4/IPv6 허용 문자만 통과, 3~45자 범위
 * Plan SC: FR-BILLR2.4
 */
export function sanitizeIp(ip: string | undefined | null): string {
  if (!ip || typeof ip !== 'string') return 'unknown';
  if (/^[0-9a-fA-F:.]{3,45}$/.test(ip)) return ip;
  return 'invalid';
}

const rawLogger = createServiceAuditLogger('billing-service', 'billing');

/**
 * 빌링 이벤트 감사 로그 기록 (입력 sanitize 후 전달)
 * createServiceAuditLogger 팩토리로 보일러플레이트 제거 + R55에서 입력 검증 추가
 */
export async function logBillingEvent(
  action: string,
  actor: string,
  target: string,
  tenantId: string,
  ip: string | undefined | null,
  userAgent: string | undefined | null,
  metadata?: Record<string, unknown>,
): Promise<void> {
  await rawLogger(
    action,
    actor,
    target,
    tenantId,
    sanitizeIp(ip),
    sanitizeUserAgent(userAgent),
    metadata,
  );
}
