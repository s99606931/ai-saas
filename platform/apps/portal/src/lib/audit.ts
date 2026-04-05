// Design Ref: DESIGN-MTU-U1-P §H — 프론트엔드 감사 로그 유틸리티
// Plan SC: FR-UP.20 (SG-01 해결) — Prisma DB 기록 연동
// CSAP: D-06

/**
 * 프론트엔드 감사 로그 전송
 *
 * 관리자 모든 작업을 audit-service로 전송합니다.
 * SG-01 해결: console.log → HTTP POST (audit-service)
 */
export async function sendAuditLog(entry: {
  action: string;
  target?: string;
  targetType?: string;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  const auditUrl = process.env['NEXT_PUBLIC_AUDIT_SERVICE_URL'] ?? 'http://localhost:3012';
  try {
    await fetch(`${auditUrl}/audit/logs`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // FR-UP.21 (SG-02 해결): 인증 헤더 포함
        'Authorization': `Bearer ${getAccessToken()}`,
      },
      body: JSON.stringify(entry),
    });
  } catch {
    // 감사 로그 전송 실패 시 로컬 폴백 (서비스 가용성 우선)
    console.error('감사 로그 전송 실패');
  }
}

function getAccessToken(): string {
  if (typeof window === 'undefined') return '';
  return localStorage.getItem('accessToken') ?? '';
}
