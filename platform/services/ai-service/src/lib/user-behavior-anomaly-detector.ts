// Design Ref: §R177 AI기반사용자행동이상탐지
// Plan SC: FR-R177.1~5

export type AnomalyType = 'UNUSUAL_TIME' | 'EXCESSIVE_REQUESTS' | 'FORBIDDEN_ACCESS' | 'BULK_EXPORT' | 'CREDENTIAL_STUFFING';

export interface UserEvent {
  userId: string;
  tenantId: string;
  action: string;
  resourcePath: string;
  timestamp: number; // epoch ms
  ipAddress: string;
  statusCode: number;
}

export interface AnomalyAlert {
  userId: string;
  tenantId: string;
  type: AnomalyType;
  description: string;
  severity: 'HIGH' | 'MEDIUM' | 'LOW';
  detectedAt: string;
  evidenceCount: number;
}

export interface UserBaseline {
  userId: string;
  avgRequestsPerHour: number;
  typicalHours: number[]; // 0-23
  commonIps: string[];
}

export interface AuditEntry {
  action: string;
  userId?: string;
  timestamp: string;
}

export class UserBehaviorAnomalyDetector {
  private events = new Map<string, UserEvent[]>(); // userId -> events
  private baselines = new Map<string, UserBaseline>();
  private alerts: AnomalyAlert[] = [];
  private auditLog: AuditEntry[] = [];

  // FR-R177.1 이벤트 기록
  recordEvent(event: UserEvent): void {
    const list = this.events.get(event.userId) ?? [];
    list.push({ ...event });
    this.events.set(event.userId, list);
  }

  // FR-R177.2 베이스라인 등록
  registerBaseline(baseline: UserBaseline): void {
    this.baselines.set(baseline.userId, baseline);
  }

  // FR-R177.3 이상 탐지
  detect(userId: string): AnomalyAlert[] {
    const events = this.events.get(userId) ?? [];
    if (events.length === 0) return [];

    const detected: AnomalyAlert[] = [];
    const baseline = this.baselines.get(userId);
    const tenantId = events[0]!.tenantId;

    // 과도한 요청 탐지
    const hourBuckets = new Map<number, number>();
    for (const e of events) {
      const hour = Math.floor(e.timestamp / 3600000);
      hourBuckets.set(hour, (hourBuckets.get(hour) ?? 0) + 1);
    }
    const maxHourlyReqs = Math.max(...hourBuckets.values());
    const threshold = baseline?.avgRequestsPerHour ? baseline.avgRequestsPerHour * 3 : 100;
    if (maxHourlyReqs > threshold) {
      detected.push({
        userId, tenantId,
        type: 'EXCESSIVE_REQUESTS',
        description: `시간당 최대 ${maxHourlyReqs}건 요청 (임계값 ${threshold}건)`,
        severity: 'HIGH',
        detectedAt: new Date().toISOString(),
        evidenceCount: maxHourlyReqs,
      });
    }

    // 비정상 시간대 접근
    if (baseline) {
      const nightEvents = events.filter((e) => {
        const hour = new Date(e.timestamp).getHours();
        return !baseline.typicalHours.includes(hour);
      });
      if (nightEvents.length > events.length * 0.5) {
        detected.push({
          userId, tenantId,
          type: 'UNUSUAL_TIME',
          description: `비정상 시간대 접근 ${nightEvents.length}건`,
          severity: 'MEDIUM',
          detectedAt: new Date().toISOString(),
          evidenceCount: nightEvents.length,
        });
      }
    }

    // 403 오류 반복 (크리덴셜 스터핑 의심)
    const forbidden = events.filter((e) => e.statusCode === 403 || e.statusCode === 401);
    if (forbidden.length >= 5) {
      detected.push({
        userId, tenantId,
        type: 'CREDENTIAL_STUFFING',
        description: `인증 실패 ${forbidden.length}건 연속`,
        severity: 'HIGH',
        detectedAt: new Date().toISOString(),
        evidenceCount: forbidden.length,
      });
    }

    // 대량 내보내기
    const exports = events.filter((e) => e.action.toLowerCase().includes('export') || e.resourcePath.includes('/export'));
    if (exports.length >= 3) {
      detected.push({
        userId, tenantId,
        type: 'BULK_EXPORT',
        description: `대량 내보내기 시도 ${exports.length}건`,
        severity: 'MEDIUM',
        detectedAt: new Date().toISOString(),
        evidenceCount: exports.length,
      });
    }

    this.alerts.push(...detected);
    if (detected.length > 0) {
      this.auditLog.push({ action: 'ANOMALY_DETECTED', userId, timestamp: new Date().toISOString() });
    }

    return detected;
  }

  // FR-R177.4 경고 목록 조회
  getAlerts(tenantId?: string): AnomalyAlert[] {
    return tenantId ? this.alerts.filter((a) => a.tenantId === tenantId) : [...this.alerts];
  }

  // FR-R177.5 감사 로그 (CSAP D-06)
  getAuditLog(): AuditEntry[] {
    return [...this.auditLog];
  }
}
