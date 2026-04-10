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
      },
      // FR-L03.2: HttpOnly 쿠키 자동 전송 (localStorage 토큰 제거)
      // Design Ref: L-03-HTTPONLY-COOKIE.design.md §2
      credentials: 'include',
      body: JSON.stringify(entry),
    });
  } catch {
    // 감사 로그 전송 실패 시 로컬 폴백 (서비스 가용성 우선)
    // 감사 로그 전송 실패 시 서버 사이드에서만 로깅 (클라이언트 노출 방지)
    if (typeof window === 'undefined') {
      process.stderr.write('감사 로그 전송 실패\n');
    }
  }
}

// NOTE: getAccessToken() 제거 — localStorage 토큰 저장은 XSS 취약점
// FR-L03.2: HttpOnly 쿠키로 전환, credentials: 'include'로 자동 전송
// Design Ref: L-03-HTTPONLY-COOKIE.design.md §2
