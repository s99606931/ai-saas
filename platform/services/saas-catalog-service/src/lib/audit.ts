// 감사 로그 유틸리티 (CSAP D-06)
// Design Ref: SVC-SAASCAT-R3 DESIGN
// Plan SC: FR-SCAT.6

/** 감사 로그 항목 */
export interface AuditEntry {
  timestamp: string;
  actor: string;
  tenantId: string;
  action: string;
  target: string;
  details?: Record<string, unknown>;
}

/** 인메모리 감사 로그 저장소 (프로덕션 시 audit-service HTTP 호출로 전환) */
const auditLog: AuditEntry[] = [];

/**
 * 감사 로그 기록
 * CSAP D-06: 모든 민감 작업 전수 기록
 */
export function recordAudit(entry: AuditEntry): void {
  auditLog.push(entry);
}

/** 감사 로그 조회 (테넌트별) */
export function getAuditLog(tenantId: string): AuditEntry[] {
  return auditLog.filter((e) => e.tenantId === tenantId);
}

/** 감사 로그 초기화 (테스트용) */
export function clearAuditLog(): void {
  auditLog.length = 0;
}
