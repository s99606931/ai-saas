// 제로트러스트 네트워크 정책 -- FR-N304.1~FR-N304.6
// Design Ref: MTU-N304 DESIGN §1~§6
// Plan SC: SC-1 (비인가차단 99%+), SC-2 (정책적용 1초), SC-3 (오탐 5%), SC-4 (감사 100%)
// CSAP: D-06 감사 로그, D-08 접근통제, N2SF 준수

// -- 타입 정의 ────────────────────────────────────────────────────────────────

/** 마이크로세그먼트 */
export interface MicroSegment {
  readonly segmentId: string;
  readonly name: string;
  readonly services: string[];
  readonly dataClassification: 'public' | 'internal' | 'confidential' | 'restricted';
  readonly allowedSegments: string[];
}

/** 디바이스 신뢰도 */
export interface DeviceTrust {
  readonly deviceId: string;
  readonly userId: string;
  readonly deviceType: 'managed' | 'byod' | 'unknown';
  readonly osVersion: string;
  readonly patchLevel: 'current' | 'outdated' | 'critical';
  readonly encryptionEnabled: boolean;
  readonly antivirusActive: boolean;
  readonly trustScore: number; // 0~100
  readonly lastAssessed: string;
}

/** 접근 요청 */
export interface AccessRequest {
  readonly requestId: string;
  readonly userId: string;
  readonly deviceId: string;
  readonly sourceIp: string;
  readonly targetService: string;
  readonly targetSegment: string;
  readonly requestedAction: string;
  readonly timestamp: string;
}

/** 접근 결정 */
export interface AccessDecision {
  readonly decisionId: string;
  readonly requestId: string;
  readonly decision: 'allow' | 'deny' | 'mfa_required' | 'quarantine';
  readonly reason: string;
  readonly riskScore: number;
  readonly appliedPolicies: string[];
  readonly decidedAt: string;
}

/** 정책 위반 */
export interface PolicyViolation {
  readonly violationId: string;
  readonly tenantId: string;
  readonly requestId: string;
  readonly violationType: 'unauthorized_access' | 'policy_bypass' | 'anomalous_behavior' | 'segment_breach';
  readonly severity: 'critical' | 'high' | 'medium' | 'low';
  readonly description: string;
  readonly detectedAt: string;
}

/** 감사 로그 */
export interface ZeroTrustAuditEntry {
  readonly timestamp: string;
  readonly actor: string;
  readonly tenantId: string;
  readonly action: string;
  readonly target: string;
  readonly details: Record<string, unknown>;
}

// -- 감사 로그 ────────────────────────────────────────────────────────────────

const auditLog: ZeroTrustAuditEntry[] = [];

function recordAudit(entry: Omit<ZeroTrustAuditEntry, 'timestamp'>): void {
  auditLog.push({ ...entry, timestamp: new Date().toISOString() });
}

export function getZeroTrustAuditLog(tenantId: string): readonly ZeroTrustAuditEntry[] {
  return auditLog.filter(e => e.tenantId === tenantId);
}

// -- 세그먼트 관리 ────────────────────────────────────────────────────────────

const segmentStore: Map<string, MicroSegment[]> = new Map();

/** 마이크로세그멘테이션 정책 정의 -- FR-N304.1 */
export function defineSegment(
  tenantId: string,
  name: string,
  services: string[],
  dataClassification: MicroSegment['dataClassification'],
  allowedSegments: string[] = [],
): MicroSegment {
  const segment: MicroSegment = {
    segmentId: `seg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    name,
    services,
    dataClassification,
    allowedSegments,
  };

  const existing = segmentStore.get(tenantId) ?? [];
  existing.push(segment);
  segmentStore.set(tenantId, existing);

  recordAudit({
    actor: 'system',
    tenantId,
    action: 'SEGMENT_DEFINED',
    target: segment.segmentId,
    details: { name, services, dataClassification },
  });

  return segment;
}

/** 세그먼트 조회 */
export function getSegments(tenantId: string): readonly MicroSegment[] {
  return segmentStore.get(tenantId) ?? [];
}

// -- 디바이스 신뢰도 평가 ────────────────────────────────────────────────────

/** 디바이스 신뢰도 평가 -- FR-N304.2 */
export function assessDeviceTrust(
  userId: string,
  deviceId: string,
  deviceInfo: {
    deviceType: DeviceTrust['deviceType'];
    osVersion: string;
    patchLevel: DeviceTrust['patchLevel'];
    encryptionEnabled: boolean;
    antivirusActive: boolean;
  },
): DeviceTrust {
  let trustScore = 100;

  // 디바이스 유형 감점
  if (deviceInfo.deviceType === 'byod') trustScore -= 20;
  else if (deviceInfo.deviceType === 'unknown') trustScore -= 40;

  // 패치 레벨 감점
  if (deviceInfo.patchLevel === 'outdated') trustScore -= 15;
  else if (deviceInfo.patchLevel === 'critical') trustScore -= 30;

  // 암호화 미사용 감점
  if (!deviceInfo.encryptionEnabled) trustScore -= 20;

  // 백신 미활성 감점
  if (!deviceInfo.antivirusActive) trustScore -= 15;

  return {
    deviceId,
    userId,
    deviceType: deviceInfo.deviceType,
    osVersion: deviceInfo.osVersion,
    patchLevel: deviceInfo.patchLevel,
    encryptionEnabled: deviceInfo.encryptionEnabled,
    antivirusActive: deviceInfo.antivirusActive,
    trustScore: Math.max(0, trustScore),
    lastAssessed: new Date().toISOString(),
  };
}

// -- 동적 접근 결정 ──────────────────────────────────────────────────────────

/** 동적 접근 결정 -- FR-N304.3 */
export function makeAccessDecision(
  tenantId: string,
  request: AccessRequest,
  deviceTrust: DeviceTrust,
): AccessDecision {
  const segments = getSegments(tenantId);
  const targetSegment = segments.find(s =>
    s.services.includes(request.targetService) || s.name === request.targetSegment,
  );

  const appliedPolicies: string[] = [];
  let riskScore = 0;
  let decision: AccessDecision['decision'] = 'allow';
  let reason = '정상 접근';

  // 디바이스 신뢰도 체크
  if (deviceTrust.trustScore < 30) {
    riskScore += 50;
    appliedPolicies.push('device-trust-minimum');
  } else if (deviceTrust.trustScore < 60) {
    riskScore += 25;
    appliedPolicies.push('device-trust-warning');
  }

  // 세그먼트 접근 체크
  if (targetSegment) {
    if (targetSegment.dataClassification === 'restricted' && deviceTrust.deviceType !== 'managed') {
      riskScore += 40;
      appliedPolicies.push('restricted-segment-managed-only');
    }
    if (targetSegment.dataClassification === 'confidential' && deviceTrust.trustScore < 70) {
      riskScore += 30;
      appliedPolicies.push('confidential-high-trust-required');
    }
  }

  // 최종 결정
  if (riskScore >= 70) {
    decision = 'deny';
    reason = `높은 위험 점수 (${riskScore}): ${appliedPolicies.join(', ')}`;
  } else if (riskScore >= 40) {
    decision = 'mfa_required';
    reason = `중간 위험 (${riskScore}): 추가 인증 필요`;
  } else if (riskScore >= 20) {
    decision = 'allow';
    reason = `경고 수준 (${riskScore}): 접근 허용하되 모니터링`;
  }

  recordAudit({
    actor: request.userId,
    tenantId,
    action: 'ACCESS_DECISION',
    target: request.targetService,
    details: { decision, riskScore, deviceTrustScore: deviceTrust.trustScore },
  });

  return {
    decisionId: `dec-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    requestId: request.requestId,
    decision,
    reason,
    riskScore,
    appliedPolicies,
    decidedAt: new Date().toISOString(),
  };
}

// -- 위반 탐지 ────────────────────────────────────────────────────────────────

const violationStore: PolicyViolation[] = [];

/** 정책 위반 실시간 탐지 -- FR-N304.4 */
export function detectViolation(
  tenantId: string,
  request: AccessRequest,
  decision: AccessDecision,
): PolicyViolation | null {
  if (decision.decision === 'allow') return null;

  let violationType: PolicyViolation['violationType'] = 'unauthorized_access';
  let severity: PolicyViolation['severity'] = 'medium';

  if (decision.riskScore >= 70) {
    violationType = 'unauthorized_access';
    severity = 'critical';
  } else if (decision.riskScore >= 50) {
    violationType = 'anomalous_behavior';
    severity = 'high';
  } else if (decision.decision === 'mfa_required') {
    violationType = 'policy_bypass';
    severity = 'medium';
  }

  const violation: PolicyViolation = {
    violationId: `viol-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    tenantId,
    requestId: request.requestId,
    violationType,
    severity,
    description: `${request.userId}: ${request.targetService} 접근 시도 - ${decision.reason}`,
    detectedAt: new Date().toISOString(),
  };

  violationStore.push(violation);

  recordAudit({
    actor: 'system',
    tenantId,
    action: 'VIOLATION_DETECTED',
    target: violation.violationId,
    details: { violationType, severity, userId: request.userId },
  });

  return violation;
}

/** 위반 이력 조회 */
export function getViolations(tenantId: string): readonly PolicyViolation[] {
  return violationStore.filter(v => v.tenantId === tenantId);
}

/** 제로트러스트 네트워크 서비스 */
export class ZeroTrustNetworkService {
  constructor(private readonly tenantId: string) {}

  defineSegment(name: string, services: string[], classification: MicroSegment['dataClassification']): MicroSegment {
    return defineSegment(this.tenantId, name, services, classification);
  }

  getSegments(): readonly MicroSegment[] {
    return getSegments(this.tenantId);
  }

  assessDevice(userId: string, deviceId: string, info: Parameters<typeof assessDeviceTrust>[2]): DeviceTrust {
    return assessDeviceTrust(userId, deviceId, info);
  }

  decide(request: AccessRequest, trust: DeviceTrust): AccessDecision {
    return makeAccessDecision(this.tenantId, request, trust);
  }

  detectViolation(request: AccessRequest, decision: AccessDecision): PolicyViolation | null {
    return detectViolation(this.tenantId, request, decision);
  }

  getViolations(): readonly PolicyViolation[] {
    return getViolations(this.tenantId);
  }

  getAuditLog(): readonly ZeroTrustAuditEntry[] {
    return getZeroTrustAuditLog(this.tenantId);
  }
}
