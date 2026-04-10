// 감사 로그 서비스 클라이언트
// Design Ref: DESIGN-MTU-P15 §2 FR-P15.1
// CSAP: D-06 감사 로그 조회
// NOTE: security-monitor-service에서 감사 로그 서비스로의 읽기 요청 전용 클라이언트

/**
 * 감사 로그 서비스 조회 응답 타입
 */
export interface AuditLogItem {
  id?: string;
  actorId?: string;
  action?: string;
  target?: string;
  ip?: string;
  tenantId?: string;
  createdAt?: string;
  metadata?: Record<string, unknown>;
}

export interface AuditLogQueryResult {
  items: AuditLogItem[];
  total: number;
}

/**
 * 감사 로그 서비스 클라이언트
 * 서비스 간 통신 추상화 — 향후 gRPC/메시지 큐로 교체 가능
 */
class AuditServiceClient {
  private baseUrl: string;

  constructor() {
    this.baseUrl = process.env['AUDIT_SERVICE_URL'] ?? 'http://localhost:3012';
  }

  /**
   * 감사 로그 조회
   * @param action 감사 로그 액션 필터
   * @param fromDate 조회 시작일 (ISO 8601)
   * @param limit 최대 조회 건수
   */
  async queryLogs(params: { action: string; fromDate: string; limit?: number }): Promise<AuditLogQueryResult> {
    const { action, fromDate, limit = 100 } = params;
    const url = `${this.baseUrl}/audit/logs?action=${encodeURIComponent(action)}&fromDate=${encodeURIComponent(fromDate)}&limit=${limit}`;

    try {
      const response = await fetch(url, {
        signal: AbortSignal.timeout(10000), // CSAP D-07: 서비스 간 통신 타임아웃 10초
      });
      if (!response.ok) {
        return { items: [], total: 0 };
      }
      const data = (await response.json()) as { items?: AuditLogItem[]; total?: number };
      return {
        items: data.items ?? [],
        total: data.total ?? data.items?.length ?? 0,
      };
    } catch {
      // 감사 서비스 연결 실패 시 빈 결과 반환 (서비스 가용성 유지)
      return { items: [], total: 0 };
    }
  }
}

/** 싱글턴 감사 로그 클라이언트 */
export const auditClient = new AuditServiceClient();
