// 이상 로그인 탐지 -- FR-N288.1~FR-N288.6
// Design Ref: MTU-N288 | CSAP: D-06, D-08

export interface LoginAttempt {
  readonly userId: string;
  readonly tenantId: string;
  readonly timestamp: string;
  readonly ipAddress: string;
  readonly userAgent: string;
  readonly geoCountry: string;
  readonly success: boolean;
}

export interface UserBaseline {
  readonly userId: string;
  readonly typicalCountries: readonly string[];
  readonly typicalHours: readonly number[];
  readonly typicalIpPrefixes: readonly string[];
}

export type RiskLevel = 'low' | 'medium' | 'high' | 'critical';

export interface RiskAssessment {
  readonly userId: string;
  readonly score: number; // 0~100
  readonly level: RiskLevel;
  readonly reasons: readonly string[];
  readonly recommendedAction: 'allow' | 'mfa' | 'block';
}

export interface AnomalyAuditEntry {
  readonly timestamp: string;
  readonly tenantId: string;
  readonly userId: string;
  readonly action: string;
  readonly riskScore: number;
  readonly details: Record<string, unknown>;
}

const auditLog: AnomalyAuditEntry[] = [];
const baselineStore = new Map<string, UserBaseline>();
const failureCounts = new Map<string, { count: number; firstAt: number }>();

function recordAudit(entry: Omit<AnomalyAuditEntry, 'timestamp'>): void {
  auditLog.push({ ...entry, timestamp: new Date().toISOString() });
}

export function getAnomalyLoginAuditLog(tenantId: string): readonly AnomalyAuditEntry[] {
  return auditLog.filter((e) => e.tenantId === tenantId);
}

// FR-N288.1: 기준선 등록
export function registerBaseline(baseline: UserBaseline): void {
  baselineStore.set(baseline.userId, baseline);
}

export function getBaseline(userId: string): UserBaseline | undefined {
  return baselineStore.get(userId);
}

// FR-N288.2: 이상 패턴 탐지
function ipPrefix(ip: string): string {
  return ip.split('.').slice(0, 2).join('.');
}

export function evaluateLogin(attempt: LoginAttempt): RiskAssessment {
  const baseline = baselineStore.get(attempt.userId);
  const reasons: string[] = [];
  let score = 0;

  if (!baseline) {
    reasons.push('기준선 없음 (신규 사용자)');
    score += 30;
  } else {
    if (!baseline.typicalCountries.includes(attempt.geoCountry)) {
      reasons.push(`비정상 국가: ${attempt.geoCountry}`);
      score += 40;
    }
    const hour = new Date(attempt.timestamp).getUTCHours();
    if (!baseline.typicalHours.includes(hour)) {
      reasons.push(`비정상 시간: ${hour}시 UTC`);
      score += 15;
    }
    if (!baseline.typicalIpPrefixes.includes(ipPrefix(attempt.ipAddress))) {
      reasons.push(`비정상 IP 대역: ${ipPrefix(attempt.ipAddress)}`);
      score += 25;
    }
  }

  // FR-N288.3: 무차별 대입 탐지
  if (!attempt.success) {
    const key = `${attempt.tenantId}:${attempt.userId}`;
    const now = Date.now();
    const cur = failureCounts.get(key);
    if (cur && now - cur.firstAt < 5 * 60 * 1000) {
      cur.count += 1;
      if (cur.count >= 5) {
        reasons.push(`5분 내 로그인 실패 ${cur.count}회`);
        score += 30;
      }
    } else {
      failureCounts.set(key, { count: 1, firstAt: now });
    }
  } else {
    failureCounts.delete(`${attempt.tenantId}:${attempt.userId}`);
  }

  score = Math.min(100, score);
  const level: RiskLevel = score >= 80 ? 'critical' : score >= 60 ? 'high' : score >= 30 ? 'medium' : 'low';
  const recommendedAction: 'allow' | 'mfa' | 'block' = level === 'critical' ? 'block' : level === 'high' || level === 'medium' ? 'mfa' : 'allow';

  const assessment: RiskAssessment = {
    userId: attempt.userId,
    score,
    level,
    reasons,
    recommendedAction,
  };

  recordAudit({
    tenantId: attempt.tenantId,
    userId: attempt.userId,
    action: 'LOGIN_RISK_ASSESSED',
    riskScore: score,
    details: { level, action: recommendedAction, reasons: reasons.length },
  });

  return assessment;
}

// FR-N288.4: 적응형 인증 결정
export function adaptiveAuthDecision(assessment: RiskAssessment): 'allow' | 'mfa' | 'block' {
  return assessment.recommendedAction;
}

// FR-N288.5: 알림 트리거
export interface SecurityAlert {
  readonly alertId: string;
  readonly userId: string;
  readonly level: RiskLevel;
  readonly message: string;
  readonly createdAt: string;
}

const alerts: SecurityAlert[] = [];

export function triggerAlert(assessment: RiskAssessment, tenantId: string): SecurityAlert | null {
  if (assessment.level === 'low') return null;
  const alert: SecurityAlert = {
    alertId: `alert-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    userId: assessment.userId,
    level: assessment.level,
    message: `${assessment.level.toUpperCase()} 위험: ${assessment.reasons.join(', ')}`,
    createdAt: new Date().toISOString(),
  };
  alerts.push(alert);
  recordAudit({
    tenantId,
    userId: assessment.userId,
    action: 'SECURITY_ALERT_TRIGGERED',
    riskScore: assessment.score,
    details: { alertId: alert.alertId, level: alert.level },
  });
  return alert;
}

export function getActiveAlerts(): readonly SecurityAlert[] {
  return alerts;
}

// FR-N288.6 + Service
export class AnomalyLoginDetectionService {
  constructor(private readonly tenantId: string) {}

  registerBaseline(baseline: UserBaseline): void {
    registerBaseline(baseline);
  }

  evaluate(attempt: Omit<LoginAttempt, 'tenantId'>): RiskAssessment {
    return evaluateLogin({ ...attempt, tenantId: this.tenantId });
  }

  decide(assessment: RiskAssessment): 'allow' | 'mfa' | 'block' {
    return adaptiveAuthDecision(assessment);
  }

  alert(assessment: RiskAssessment): SecurityAlert | null {
    return triggerAlert(assessment, this.tenantId);
  }

  audit(): readonly AnomalyAuditEntry[] {
    return getAnomalyLoginAuditLog(this.tenantId);
  }
}
