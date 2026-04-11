// 실시간 API 이상 트래픽 탐지 (UEBA) 엔진 -- FR-N289.1~FR-N289.6
// Design Ref: MTU-N289 DESIGN §1~§6
// Plan SC: SC-1 (탐지율 90%+), SC-2 (오탐률 3% 이하), SC-3 (탐지~대응 <5초), SC-4 (감사 100%)
// CSAP: D-06 감사 로그, D-08 접근 통제, D-12 개발 보안

// -- 타입 정의 ────────────────────────────────────────────────────────────────

/** API 호출 이벤트 */
export interface APICallEvent {
  readonly eventId: string;
  readonly tenantId: string;
  readonly userId: string;
  readonly endpoint: string;
  readonly method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  readonly statusCode: number;
  readonly responseTimeMs: number;
  readonly payloadSizeBytes: number;
  readonly ipAddress: string;
  readonly userAgent: string;
  readonly timestamp: string;
}

/** 사용자/테넌트 행동 기준선 */
export interface BehaviorBaseline {
  readonly entityId: string;        // userId 또는 tenantId
  readonly entityType: 'user' | 'tenant';
  readonly avgRequestsPerMinute: number;
  readonly avgPayloadSizeBytes: number;
  readonly avgResponseTimeMs: number;
  readonly typicalEndpoints: string[];
  readonly typicalMethods: string[];
  readonly typicalHours: number[];
  readonly stdDevRequests: number;
  readonly dataPoints: number;
  readonly lastUpdated: string;
}

/** 이상 탐지 결과 */
export interface AnomalyDetectionResult {
  readonly detectionId: string;
  readonly eventId: string;
  readonly entityId: string;
  readonly anomalyType: AnomalyType;
  readonly severity: 'info' | 'warning' | 'critical';
  readonly deviationScore: number;    // 표준편차 배수
  readonly description: string;
  readonly baseline: BehaviorBaseline;
  readonly detectedAt: string;
}

/** 이상 유형 */
export type AnomalyType =
  | 'rate_spike'            // 요청 빈도 급증
  | 'payload_anomaly'       // 비정상 페이로드 크기
  | 'endpoint_scan'         // 엔드포인트 스캔
  | 'time_anomaly'          // 비정상 시간대 접근
  | 'brute_force'           // 무차별 대입
  | 'data_exfiltration'     // 대량 데이터 유출 시도
  | 'api_abuse';            // API 남용

/** 자동 대응 액션 */
export interface AutoResponseAction {
  readonly actionId: string;
  readonly detectionId: string;
  readonly actionType: 'rate_limit' | 'block' | 'mfa_challenge' | 'alert' | 'monitor';
  readonly target: string;
  readonly duration: number;          // 초
  readonly reason: string;
  readonly executedAt: string;
}

/** 위협 인텔리전스 리포트 */
export interface ThreatReport {
  readonly reportId: string;
  readonly tenantId: string;
  readonly period: string;
  readonly totalEvents: number;
  readonly anomaliesDetected: number;
  readonly actionsExecuted: number;
  readonly topThreats: ThreatSummary[];
  readonly recommendations: string[];
  readonly generatedAt: string;
}

/** 위협 요약 */
export interface ThreatSummary {
  readonly anomalyType: AnomalyType;
  readonly count: number;
  readonly affectedEntities: number;
  readonly avgSeverity: number;
}

/** 감사 로그 */
export interface UEBAAuditEntry {
  readonly timestamp: string;
  readonly actor: string;
  readonly tenantId: string;
  readonly action: string;
  readonly target: string;
  readonly details: Record<string, unknown>;
}

// -- 감사 로그 ────────────────────────────────────────────────────────────────

const auditLog: UEBAAuditEntry[] = [];

function recordAudit(entry: Omit<UEBAAuditEntry, 'timestamp'>): void {
  auditLog.push({ ...entry, timestamp: new Date().toISOString() });
}

export function getUEBAAuditLog(tenantId: string): readonly UEBAAuditEntry[] {
  return auditLog.filter(e => e.tenantId === tenantId);
}

// -- 기준선 저장소 ────────────────────────────────────────────────────────────

const baselineStore: Map<string, BehaviorBaseline> = new Map();
const eventHistory: Map<string, APICallEvent[]> = new Map();
const detectionHistory: AnomalyDetectionResult[] = [];
const actionHistory: AutoResponseAction[] = [];

// -- 기준선 관리 ──────────────────────────────────────────────────────────────

/** 행동 기준선 구축/업데이트 -- FR-N289.2 */
export function updateBaseline(event: APICallEvent): BehaviorBaseline {
  const key = `${event.tenantId}:${event.userId}`;
  const history = eventHistory.get(key) ?? [];

  history.push(event);
  if (history.length > 10000) history.splice(0, history.length - 10000);
  eventHistory.set(key, history);

  // 통계 계산
  const recentWindow = 60 * 60 * 1000; // 1시간
  const now = Date.now();
  const recentEvents = history.filter(
    e => now - new Date(e.timestamp).getTime() < recentWindow,
  );

  const requestsPerMinute = recentEvents.length / 60;
  const avgPayload = recentEvents.reduce((s, e) => s + e.payloadSizeBytes, 0) / Math.max(1, recentEvents.length);
  const avgResponse = recentEvents.reduce((s, e) => s + e.responseTimeMs, 0) / Math.max(1, recentEvents.length);

  // 표준편차 계산
  const minuteBuckets = new Map<number, number>();
  for (const e of recentEvents) {
    const minute = Math.floor(new Date(e.timestamp).getTime() / 60000);
    minuteBuckets.set(minute, (minuteBuckets.get(minute) ?? 0) + 1);
  }
  const bucketValues = Array.from(minuteBuckets.values());
  const mean = bucketValues.reduce((s, v) => s + v, 0) / Math.max(1, bucketValues.length);
  const variance = bucketValues.reduce((s, v) => s + (v - mean) ** 2, 0) / Math.max(1, bucketValues.length);
  const stdDev = Math.sqrt(variance);

  const endpoints = [...new Set(recentEvents.map(e => e.endpoint))];
  const methods = [...new Set(recentEvents.map(e => e.method))];
  const hours = [...new Set(recentEvents.map(e => new Date(e.timestamp).getHours()))];

  const baseline: BehaviorBaseline = {
    entityId: event.userId,
    entityType: 'user',
    avgRequestsPerMinute: Math.round(requestsPerMinute * 100) / 100,
    avgPayloadSizeBytes: Math.round(avgPayload),
    avgResponseTimeMs: Math.round(avgResponse),
    typicalEndpoints: endpoints.slice(0, 20),
    typicalMethods: methods,
    typicalHours: hours,
    stdDevRequests: Math.round(stdDev * 100) / 100,
    dataPoints: history.length,
    lastUpdated: new Date().toISOString(),
  };

  baselineStore.set(key, baseline);
  return baseline;
}

/** 기준선 조회 */
export function getBaseline(tenantId: string, userId: string): BehaviorBaseline | undefined {
  return baselineStore.get(`${tenantId}:${userId}`);
}

// -- 이상 탐지 ────────────────────────────────────────────────────────────────

/** 실시간 이상 탐지 -- FR-N289.3 */
export function detectAnomaly(
  event: APICallEvent,
  baseline?: BehaviorBaseline,
): AnomalyDetectionResult[] {
  const results: AnomalyDetectionResult[] = [];

  if (!baseline || baseline.dataPoints < 10) {
    return results; // 기준선 미구축 시 탐지 건너뛰기
  }

  const key = `${event.tenantId}:${event.userId}`;
  const history = eventHistory.get(key) ?? [];

  // 1. 요청 빈도 급증 검사
  const recentMinute = history.filter(
    e => Date.now() - new Date(e.timestamp).getTime() < 60000,
  ).length;
  const rateDeviation = baseline.stdDevRequests > 0
    ? (recentMinute - baseline.avgRequestsPerMinute) / baseline.stdDevRequests
    : 0;

  if (rateDeviation > 3) {
    results.push({
      detectionId: `det-${Date.now()}-rate`,
      eventId: event.eventId,
      entityId: event.userId,
      anomalyType: 'rate_spike',
      severity: rateDeviation > 5 ? 'critical' : 'warning',
      deviationScore: Math.round(rateDeviation * 100) / 100,
      description: `요청 빈도 ${recentMinute}회/분 (기준: ${baseline.avgRequestsPerMinute}회/분, ${rateDeviation.toFixed(1)}σ 이탈)`,
      baseline,
      detectedAt: new Date().toISOString(),
    });
  }

  // 2. 페이로드 이상 검사
  if (event.payloadSizeBytes > baseline.avgPayloadSizeBytes * 10 && baseline.avgPayloadSizeBytes > 0) {
    results.push({
      detectionId: `det-${Date.now()}-payload`,
      eventId: event.eventId,
      entityId: event.userId,
      anomalyType: 'payload_anomaly',
      severity: 'warning',
      deviationScore: event.payloadSizeBytes / Math.max(1, baseline.avgPayloadSizeBytes),
      description: `비정상 페이로드 크기: ${event.payloadSizeBytes}B (기준: ${baseline.avgPayloadSizeBytes}B)`,
      baseline,
      detectedAt: new Date().toISOString(),
    });
  }

  // 3. 엔드포인트 스캔 검사
  const recentEndpoints = new Set(
    history
      .filter(e => Date.now() - new Date(e.timestamp).getTime() < 300000)
      .map(e => e.endpoint),
  );
  if (recentEndpoints.size > baseline.typicalEndpoints.length * 3 && baseline.typicalEndpoints.length > 0) {
    results.push({
      detectionId: `det-${Date.now()}-scan`,
      eventId: event.eventId,
      entityId: event.userId,
      anomalyType: 'endpoint_scan',
      severity: 'critical',
      deviationScore: recentEndpoints.size / Math.max(1, baseline.typicalEndpoints.length),
      description: `5분 내 ${recentEndpoints.size}개 엔드포인트 접근 (기준: ${baseline.typicalEndpoints.length}개)`,
      baseline,
      detectedAt: new Date().toISOString(),
    });
  }

  // 4. 시간대 이상 검사
  const hour = new Date(event.timestamp).getHours();
  if (!baseline.typicalHours.includes(hour) && baseline.typicalHours.length > 0) {
    results.push({
      detectionId: `det-${Date.now()}-time`,
      eventId: event.eventId,
      entityId: event.userId,
      anomalyType: 'time_anomaly',
      severity: 'info',
      deviationScore: 1,
      description: `비정상 시간대 접근: ${hour}시 (일반: ${baseline.typicalHours.join(', ')}시)`,
      baseline,
      detectedAt: new Date().toISOString(),
    });
  }

  // 5. 대량 데이터 유출 시도
  const recentLargePayloads = history.filter(
    e => Date.now() - new Date(e.timestamp).getTime() < 600000 &&
      e.method === 'GET' && e.payloadSizeBytes > 100000,
  );
  if (recentLargePayloads.length > 10) {
    results.push({
      detectionId: `det-${Date.now()}-exfil`,
      eventId: event.eventId,
      entityId: event.userId,
      anomalyType: 'data_exfiltration',
      severity: 'critical',
      deviationScore: recentLargePayloads.length,
      description: `10분 내 대용량 GET 요청 ${recentLargePayloads.length}건 감지`,
      baseline,
      detectedAt: new Date().toISOString(),
    });
  }

  // 이력 저장
  detectionHistory.push(...results);

  for (const result of results) {
    recordAudit({
      actor: 'system',
      tenantId: event.tenantId,
      action: 'ANOMALY_DETECTED',
      target: result.detectionId,
      details: {
        anomalyType: result.anomalyType,
        severity: result.severity,
        deviationScore: result.deviationScore,
        userId: event.userId,
      },
    });
  }

  return results;
}

// -- 자동 대응 ────────────────────────────────────────────────────────────────

/** 자동 대응 실행 -- FR-N289.4 */
export function executeAutoResponse(
  tenantId: string,
  detection: AnomalyDetectionResult,
): AutoResponseAction {
  let actionType: AutoResponseAction['actionType'] = 'monitor';
  let duration = 0;

  switch (detection.severity) {
    case 'critical':
      actionType = detection.anomalyType === 'brute_force' ? 'block' : 'rate_limit';
      duration = 3600; // 1시간
      break;
    case 'warning':
      actionType = 'rate_limit';
      duration = 600; // 10분
      break;
    case 'info':
      actionType = 'monitor';
      duration = 300; // 5분
      break;
  }

  const action: AutoResponseAction = {
    actionId: `act-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    detectionId: detection.detectionId,
    actionType,
    target: detection.entityId,
    duration,
    reason: detection.description,
    executedAt: new Date().toISOString(),
  };

  actionHistory.push(action);

  recordAudit({
    actor: 'system',
    tenantId,
    action: 'AUTO_RESPONSE_EXECUTED',
    target: action.actionId,
    details: {
      actionType,
      target: detection.entityId,
      duration,
      anomalyType: detection.anomalyType,
    },
  });

  return action;
}

// -- 위협 리포트 ──────────────────────────────────────────────────────────────

/** 위협 인텔리전스 리포트 -- FR-N289.5 */
export function generateThreatReport(
  tenantId: string,
  periodHours: number = 24,
): ThreatReport {
  const cutoff = Date.now() - periodHours * 60 * 60 * 1000;
  const recentDetections = detectionHistory.filter(
    d => new Date(d.detectedAt).getTime() > cutoff,
  );
  const recentActions = actionHistory.filter(
    a => new Date(a.executedAt).getTime() > cutoff,
  );

  // 위협 요약
  const threatMap = new Map<AnomalyType, { count: number; entities: Set<string>; severitySum: number }>();
  for (const det of recentDetections) {
    const existing = threatMap.get(det.anomalyType) ?? { count: 0, entities: new Set(), severitySum: 0 };
    existing.count++;
    existing.entities.add(det.entityId);
    existing.severitySum += det.severity === 'critical' ? 3 : det.severity === 'warning' ? 2 : 1;
    threatMap.set(det.anomalyType, existing);
  }

  const topThreats: ThreatSummary[] = Array.from(threatMap.entries())
    .map(([type, data]) => ({
      anomalyType: type,
      count: data.count,
      affectedEntities: data.entities.size,
      avgSeverity: Math.round((data.severitySum / data.count) * 100) / 100,
    }))
    .sort((a, b) => b.count - a.count);

  const recommendations: string[] = [];
  if (topThreats.some(t => t.anomalyType === 'brute_force')) {
    recommendations.push('무차별 대입 공격 탐지: 계정 잠금 정책 강화를 권고합니다');
  }
  if (topThreats.some(t => t.anomalyType === 'data_exfiltration')) {
    recommendations.push('데이터 유출 시도 탐지: DLP 정책 적용을 권고합니다');
  }
  if (topThreats.some(t => t.anomalyType === 'endpoint_scan')) {
    recommendations.push('API 스캔 탐지: WAF 규칙 업데이트를 권고합니다');
  }

  const report: ThreatReport = {
    reportId: `threat-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    tenantId,
    period: `최근 ${periodHours}시간`,
    totalEvents: recentDetections.length + recentActions.length,
    anomaliesDetected: recentDetections.length,
    actionsExecuted: recentActions.length,
    topThreats,
    recommendations,
    generatedAt: new Date().toISOString(),
  };

  recordAudit({
    actor: 'system',
    tenantId,
    action: 'THREAT_REPORT_GENERATED',
    target: report.reportId,
    details: { periodHours, anomalies: recentDetections.length, actions: recentActions.length },
  });

  return report;
}

/** API 트래픽 UEBA 서비스 */
export class APITrafficUEBAService {
  constructor(private readonly tenantId: string) {}

  processEvent(event: Omit<APICallEvent, 'tenantId'>): {
    baseline: BehaviorBaseline;
    anomalies: AnomalyDetectionResult[];
    actions: AutoResponseAction[];
  } {
    const fullEvent: APICallEvent = { ...event, tenantId: this.tenantId };
    const baseline = updateBaseline(fullEvent);
    const anomalies = detectAnomaly(fullEvent, baseline);
    const actions = anomalies.map(a => executeAutoResponse(this.tenantId, a));
    return { baseline, anomalies, actions };
  }

  getBaseline(userId: string): BehaviorBaseline | undefined {
    return getBaseline(this.tenantId, userId);
  }

  generateReport(periodHours?: number): ThreatReport {
    return generateThreatReport(this.tenantId, periodHours);
  }

  getAuditLog(): readonly UEBAAuditEntry[] {
    return getUEBAAuditLog(this.tenantId);
  }
}
