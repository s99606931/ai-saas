// Zero Trust 네트워크 정책 엔진 -- FR-N271.1~FR-N271.6
// Design Ref: MTU-N271 DESIGN §1~§6
// CSAP: D-06 감사, D-08 접근 통제
// N2SF: 네트워크 보안 영역 준수

import { randomUUID } from 'crypto';

// -- 타입 정의 ────────────────────────────────────────────────────────────────

/** 정책 액션 -- Design §1 */
export type PolicyAction = 'allow' | 'deny' | 'monitor' | 'quarantine';

/** 위협 심각도 */
export type ThreatSeverity = 'info' | 'low' | 'medium' | 'high' | 'critical';

/** 정책 규칙 -- Design §1 */
export interface ZeroTrustPolicy {
  id: string;
  name: string;
  description: string;
  sourceZone: string;
  destinationZone: string;
  protocol: string;
  port?: number;
  action: PolicyAction;
  conditions: PolicyCondition[];
  priority: number;
  isActive: boolean;
  createdAt: string;
}

/** 정책 조건 */
export interface PolicyCondition {
  field: string;
  operator: 'eq' | 'ne' | 'gt' | 'lt' | 'contains' | 'in';
  value: string | number | string[];
}

/** 트래픽 이벤트 -- Design §2 */
export interface TrafficEvent {
  id: string;
  sourceIP: string;
  destinationIP: string;
  sourceZone: string;
  destinationZone: string;
  protocol: string;
  port: number;
  bytesTransferred: number;
  timestamp: string;
  userId?: string;
  metadata: Record<string, unknown>;
}

/** 트래픽 프로파일 (기준선) -- Design §2 */
export interface TrafficProfile {
  zone: string;
  avgBytesPerMinute: number;
  avgRequestsPerMinute: number;
  peakBytesPerMinute: number;
  commonPorts: number[];
  commonProtocols: string[];
  lastUpdated: string;
}

/** 이상 탐지 결과 -- Design §3 */
export interface AnomalyDetection {
  id: string;
  trafficEventId: string;
  anomalyType: 'volume' | 'port_scan' | 'protocol' | 'time' | 'behavior';
  severity: ThreatSeverity;
  description: string;
  score: number;
  detectedAt: string;
}

/** 위협 인텔리전스 지표(IoC) -- Design §5 */
export interface ThreatIndicator {
  id: string;
  type: 'ip' | 'domain' | 'hash' | 'url';
  value: string;
  severity: ThreatSeverity;
  source: string;
  addedAt: string;
}

/** 정책 실행 결과 -- Design §4 */
export interface PolicyEnforcementResult {
  id: string;
  policyId: string;
  trafficEventId: string;
  action: PolicyAction;
  reason: string;
  enforcedAt: string;
}

/** 감사 항목 */
export interface ZeroTrustAuditEntry {
  id: string;
  action: string;
  actor: string;
  details: Record<string, unknown>;
  timestamp: string;
}

// -- 저장소 ──────────────────────────────────────────────────────────────────

const policies = new Map<string, ZeroTrustPolicy>();
const profiles = new Map<string, TrafficProfile>();
const threatIndicators = new Map<string, ThreatIndicator>();
const auditLog: ZeroTrustAuditEntry[] = [];

function recordAudit(action: string, actor: string, details: Record<string, unknown>): void {
  auditLog.push({ id: randomUUID(), action, actor, details, timestamp: new Date().toISOString() });
}

export function getZeroTrustAuditLog(): ZeroTrustAuditEntry[] {
  return [...auditLog];
}

// -- §1 정책 관리 ────────────────────────────────────────────────────────────

/** 정책 생성 -- FR-N271.1, CSAP D-08 */
export function createPolicy(params: Omit<ZeroTrustPolicy, 'id' | 'createdAt'>, actor: string): ZeroTrustPolicy {
  const policy: ZeroTrustPolicy = {
    ...params,
    id: randomUUID(),
    createdAt: new Date().toISOString(),
  };
  policies.set(policy.id, policy);
  recordAudit('POLICY_CREATED', actor, { policyId: policy.id, name: params.name });
  return policy;
}

/** 정책 평가 (트래픽 이벤트에 대해) */
export function evaluatePolicies(event: TrafficEvent): ZeroTrustPolicy | null {
  const sorted = Array.from(policies.values())
    .filter((p) => p.isActive)
    .sort((a, b) => a.priority - b.priority);

  for (const policy of sorted) {
    if (matchesPolicy(event, policy)) {
      return policy;
    }
  }
  return null;
}

function matchesPolicy(event: TrafficEvent, policy: ZeroTrustPolicy): boolean {
  if (policy.sourceZone !== '*' && policy.sourceZone !== event.sourceZone) return false;
  if (policy.destinationZone !== '*' && policy.destinationZone !== event.destinationZone) return false;
  if (policy.protocol !== '*' && policy.protocol !== event.protocol) return false;
  if (policy.port !== undefined && policy.port !== event.port) return false;

  for (const cond of policy.conditions) {
    const value = (event.metadata[cond.field] ?? '') as string | number;
    switch (cond.operator) {
      case 'eq': if (value !== cond.value) return false; break;
      case 'ne': if (value === cond.value) return false; break;
      case 'gt': if (typeof value !== 'number' || value <= (cond.value as number)) return false; break;
      case 'lt': if (typeof value !== 'number' || value >= (cond.value as number)) return false; break;
      case 'contains': if (typeof value !== 'string' || !value.includes(cond.value as string)) return false; break;
      case 'in': if (!Array.isArray(cond.value) || !cond.value.includes(String(value))) return false; break;
    }
  }
  return true;
}

export function listPolicies(): ZeroTrustPolicy[] {
  return Array.from(policies.values());
}

// -- §2 트래픽 프로파일링 ────────────────────────────────────────────────────

/** 트래픽 프로파일 업데이트 -- FR-N271.2 */
export function updateTrafficProfile(zone: string, events: TrafficEvent[]): TrafficProfile {
  const zoneEvents = events.filter((e) => e.sourceZone === zone || e.destinationZone === zone);
  const totalBytes = zoneEvents.reduce((sum, e) => sum + e.bytesTransferred, 0);
  const ports = [...new Set(zoneEvents.map((e) => e.port))];
  const protocols = [...new Set(zoneEvents.map((e) => e.protocol))];
  const minutes = Math.max(1, zoneEvents.length / 60);

  const profile: TrafficProfile = {
    zone,
    avgBytesPerMinute: totalBytes / minutes,
    avgRequestsPerMinute: zoneEvents.length / minutes,
    peakBytesPerMinute: Math.max(...zoneEvents.map((e) => e.bytesTransferred), 0),
    commonPorts: ports.slice(0, 20),
    commonProtocols: protocols,
    lastUpdated: new Date().toISOString(),
  };

  profiles.set(zone, profile);
  return profile;
}

// -- §3 이상 탐지 ────────────────────────────────────────────────────────────

/** AI 기반 이상 트래픽 탐지 -- FR-N271.3 */
export function detectAnomalies(event: TrafficEvent): AnomalyDetection[] {
  const anomalies: AnomalyDetection[] = [];
  const profile = profiles.get(event.sourceZone);

  // 볼륨 이상
  if (profile && event.bytesTransferred > profile.peakBytesPerMinute * 3) {
    anomalies.push({
      id: randomUUID(),
      trafficEventId: event.id,
      anomalyType: 'volume',
      severity: 'high',
      description: `비정상 트래픽 볼륨: ${event.bytesTransferred} bytes (기준선 피크: ${profile.peakBytesPerMinute})`,
      score: Math.min(1, event.bytesTransferred / (profile.peakBytesPerMinute * 5)),
      detectedAt: new Date().toISOString(),
    });
  }

  // 비정상 포트
  if (profile && !profile.commonPorts.includes(event.port)) {
    anomalies.push({
      id: randomUUID(),
      trafficEventId: event.id,
      anomalyType: 'port_scan',
      severity: 'medium',
      description: `비정상 포트 사용: ${event.port} (기준선 포트에 미포함)`,
      score: 0.6,
      detectedAt: new Date().toISOString(),
    });
  }

  // 비정상 프로토콜
  if (profile && !profile.commonProtocols.includes(event.protocol)) {
    anomalies.push({
      id: randomUUID(),
      trafficEventId: event.id,
      anomalyType: 'protocol',
      severity: 'medium',
      description: `비정상 프로토콜: ${event.protocol}`,
      score: 0.5,
      detectedAt: new Date().toISOString(),
    });
  }

  // IoC 매칭 (위협 인텔리전스)
  const iocMatch = checkThreatIntelligence(event);
  if (iocMatch) {
    anomalies.push({
      id: randomUUID(),
      trafficEventId: event.id,
      anomalyType: 'behavior',
      severity: iocMatch.severity,
      description: `위협 인텔리전스 매칭: ${iocMatch.value} (${iocMatch.source})`,
      score: 1.0,
      detectedAt: new Date().toISOString(),
    });
  }

  return anomalies;
}

// -- §4 자동 대응 ────────────────────────────────────────────────────────────

/** 자동 격리/차단 실행 -- FR-N271.4 */
export function enforcePolicy(
  event: TrafficEvent,
  anomalies: AnomalyDetection[],
  actor: string
): PolicyEnforcementResult {
  // 정책 기반 평가
  const matchedPolicy = evaluatePolicies(event);

  // 이상 탐지 기반 자동 대응
  let action: PolicyAction = matchedPolicy?.action ?? 'allow';
  let reason = matchedPolicy ? `정책 ${matchedPolicy.name} 적용` : '기본 허용';

  if (anomalies.length > 0) {
    const maxSeverity = anomalies.reduce((max, a) => {
      const order: ThreatSeverity[] = ['info', 'low', 'medium', 'high', 'critical'];
      return order.indexOf(a.severity) > order.indexOf(max) ? a.severity : max;
    }, 'info' as ThreatSeverity);

    if (maxSeverity === 'critical') {
      action = 'deny';
      reason = `위험 이상 탐지 (${anomalies.length}건, 최고 심각도: ${maxSeverity})`;
    } else if (maxSeverity === 'high') {
      action = 'quarantine';
      reason = `높은 이상 탐지 — 격리 조치`;
    } else if (maxSeverity === 'medium') {
      action = 'monitor';
      reason = `중간 이상 탐지 — 모니터링 강화`;
    }
  }

  const result: PolicyEnforcementResult = {
    id: randomUUID(),
    policyId: matchedPolicy?.id ?? 'auto',
    trafficEventId: event.id,
    action,
    reason,
    enforcedAt: new Date().toISOString(),
  };

  recordAudit('POLICY_ENFORCED', actor, {
    action,
    reason,
    sourceIP: event.sourceIP,
    anomalyCount: anomalies.length,
  });

  return result;
}

// -- §5 위협 인텔리전스 ──────────────────────────────────────────────────────

/** 위협 지표 등록 -- FR-N271.5 */
export function addThreatIndicator(indicator: Omit<ThreatIndicator, 'id' | 'addedAt'>, actor: string): ThreatIndicator {
  const ti: ThreatIndicator = {
    ...indicator,
    id: randomUUID(),
    addedAt: new Date().toISOString(),
  };
  threatIndicators.set(ti.id, ti);
  recordAudit('THREAT_INDICATOR_ADDED', actor, { type: indicator.type, value: indicator.value });
  return ti;
}

/** IoC 매칭 검사 */
function checkThreatIntelligence(event: TrafficEvent): ThreatIndicator | null {
  for (const [, indicator] of threatIndicators) {
    if (indicator.type === 'ip' &&
        (indicator.value === event.sourceIP || indicator.value === event.destinationIP)) {
      return indicator;
    }
  }
  return null;
}

export function listThreatIndicators(): ThreatIndicator[] {
  return Array.from(threatIndicators.values());
}
