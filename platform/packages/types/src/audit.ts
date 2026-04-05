// 감사 로그 타입
// Design Ref: D-P00.2
// CSAP: D-06 침해사고 관리 — append-only, SHA-256 체인

/**
 * 감사 로그 엔트리
 * - 모든 민감 작업을 전수 기록
 * - SHA-256 체인으로 무결성 보장
 * - 최소 1년 보존 (CSAP D-06)
 */
export interface AuditEntry {
  /** 고유 ID */
  id: string;
  /** 행위자 ID (사용자 또는 시스템) */
  actor: string;
  /** 행위 (USER_CREATE, TENANT_DELETE, LOGIN_FAIL 등) */
  action: string;
  /** 대상 ID */
  target: string;
  /** 대상 유형 (user, tenant, subscription 등) */
  targetType: string;
  /** 테넌트 ID */
  tenantId: string;
  /** 클라이언트 IP */
  ip: string;
  /** User-Agent */
  userAgent: string;
  /** 타임스탬프 (ISO 8601) */
  timestamp: string;
  /** 추가 메타데이터 */
  metadata?: Record<string, unknown>;
  /** SHA-256 해시 (현재 엔트리) */
  hash: string;
  /** 이전 엔트리 해시 (체인 무결성) */
  previousHash: string;
}
