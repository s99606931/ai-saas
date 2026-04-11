// AI 기반 이상 로그인 탐지 엔진 -- FR-N288.1~FR-N288.6
// Design Ref: MTU-N288 DESIGN §1~§6
// Plan SC: SC-1 (탐지율 95%+), SC-2 (오탐률 5% 이하), SC-3 (지연 <3초), SC-4 (감사 100%)
// CSAP: D-06 감사 로그, D-08 접근 통제, D-12 개발 보안
// N2SF: 로그인 이벤트 O등급, PII 마스킹 필수

// -- 타입 정의 ────────────────────────────────────────────────────────────────

/** 로그인 이벤트 */
export interface LoginEvent {
  readonly eventId: string;
  readonly userId: string;
  readonly tenantId: string;
  readonly ipAddress: string;
  readonly userAgent: string;
  readonly deviceFingerprint: string;
  readonly geoLocation: GeoLocation;
  readonly loginMethod: 'password' | 'mfa' | 'sso' | 'certificate';
  readonly success: boolean;
  readonly timestamp: string;
}

/** 위치 정보 */
export interface GeoLocation {
  readonly country: string;
  readonly city: string;
  readonly latitude: number;
  readonly longitude: number;
}

/** 사용자 행동 프로필 */
export interface UserBehaviorProfile {
  readonly userId: string;
  readonly tenantId: string;
  readonly typicalIPs: string[];
  readonly typicalDevices: string[];
  readonly typicalLocations: GeoLocation[];
  readonly typicalLoginHours: number[];    // 0-23
  readonly typicalLoginDays: number[];     // 0-6 (일~토)
  readonly averageLoginFrequency: number;  // 일평균
  readonly lastUpdated: string;
}

/** 위험도 스코어 */
export interface RiskScore {
  readonly eventId: string;
  readonly userId: string;
  readonly overallScore: number;   // 0~100
  readonly factors: RiskFactor[];
  readonly riskLevel: 'safe' | 'low' | 'medium' | 'high' | 'critical';
  readonly recommendation: string;
  readonly calculatedAt: string;
}

/** 위험 요인 */
export interface RiskFactor {
  readonly factorId: string;
  readonly category: 'ip' | 'device' | 'location' | 'time' | 'frequency' | 'behavior';
  readonly description: string;
  readonly weight: number;         // 0~1
  readonly score: number;          // 0~100
}

/** 적응형 인증 트리거 */
export interface AdaptiveAuthTrigger {
  readonly triggerId: string;
  readonly eventId: string;
  readonly userId: string;
  readonly action: 'allow' | 'mfa_required' | 'block' | 'notify_admin';
  readonly riskLevel: RiskScore['riskLevel'];
  readonly reason: string;
  readonly triggeredAt: string;
}

/** 보안 알림 */
export interface SecurityAlert {
  readonly alertId: string;
  readonly tenantId: string;
  readonly userId: string;
  readonly severity: 'info' | 'warning' | 'critical';
  readonly title: string;
  readonly description: string;
  readonly riskScore: number;
  readonly actions: string[];
  readonly createdAt: string;
}

/** 감사 로그 */
export interface LoginAuditEntry {
  readonly timestamp: string;
  readonly actor: string;
  readonly tenantId: string;
  readonly action: string;
  readonly target: string;
  readonly details: Record<string, unknown>;
}

// -- PII 마스킹 ────────────────────────────────────────────────────────────────

function maskIP(ip: string): string {
  const parts = ip.split('.');
  if (parts.length === 4) {
    return `${parts[0]}.${parts[1]}.*.*`;
  }
  return '[IP-마스킹]';
}

// -- 감사 로그 ────────────────────────────────────────────────────────────────

const auditLog: LoginAuditEntry[] = [];

function recordAudit(entry: Omit<LoginAuditEntry, 'timestamp'>): void {
  auditLog.push({ ...entry, timestamp: new Date().toISOString() });
}

export function getLoginAuditLog(tenantId: string): readonly LoginAuditEntry[] {
  return auditLog.filter(e => e.tenantId === tenantId);
}

// -- 행동 프로필 저장소 ───────────────────────────────────────────────────────

const profileStore: Map<string, UserBehaviorProfile> = new Map();
const loginHistory: Map<string, LoginEvent[]> = new Map();

/** 사용자 행동 프로필 업데이트 -- FR-N288.1 */
export function updateBehaviorProfile(event: LoginEvent): UserBehaviorProfile {
  const key = `${event.tenantId}:${event.userId}`;
  const history = loginHistory.get(key) ?? [];

  // 이력 추가
  history.push(event);
  if (history.length > 1000) history.splice(0, history.length - 1000);
  loginHistory.set(key, history);

  // 프로필 갱신
  const successEvents = history.filter(e => e.success);
  const hour = new Date(event.timestamp).getHours();
  const day = new Date(event.timestamp).getDay();

  const typicalIPs = [...new Set(successEvents.map(e => e.ipAddress))].slice(-10);
  const typicalDevices = [...new Set(successEvents.map(e => e.deviceFingerprint))].slice(-5);
  const typicalLocations = successEvents
    .map(e => e.geoLocation)
    .filter((loc, i, arr) => arr.findIndex(l => l.city === loc.city) === i)
    .slice(-5);

  // 활동 시간대 계산
  const hourCounts = new Array(24).fill(0);
  for (const e of successEvents) {
    hourCounts[new Date(e.timestamp).getHours()]++;
  }
  const computedTypicalHours = hourCounts
    .map((count: number, h: number) => ({ h, count }))
    .filter((x: { h: number; count: number }) => x.count > 0)
    .sort((a: { count: number }, b: { count: number }) => b.count - a.count)
    .slice(0, 8)
    .map((x: { h: number }) => x.h);

  const dayCounts = new Array(7).fill(0) as number[];
  for (const evt of successEvents) {
    const dayIdx = new Date(evt.timestamp).getDay();
    dayCounts[dayIdx] = (dayCounts[dayIdx] ?? 0) + 1;
  }
  const computedTypicalDays = dayCounts
    .map((count: number, d: number) => ({ d, count }))
    .filter((x: { d: number; count: number }) => x.count > 0)
    .sort((a: { count: number }, b: { count: number }) => b.count - a.count)
    .slice(0, 5)
    .map((x: { d: number }) => x.d);

  // 일평균 로그인 빈도
  const lastEvent = successEvents[successEvents.length - 1];
  const firstEvent = successEvents[0];
  const daySpan = successEvents.length > 1 && lastEvent && firstEvent
    ? (new Date(lastEvent.timestamp).getTime() -
       new Date(firstEvent.timestamp).getTime()) / (1000 * 60 * 60 * 24)
    : 1;
  const avgFrequency = successEvents.length / Math.max(1, daySpan);

  const profile: UserBehaviorProfile = {
    userId: event.userId,
    tenantId: event.tenantId,
    typicalIPs,
    typicalDevices,
    typicalLocations,
    typicalLoginHours: computedTypicalHours.length > 0 ? computedTypicalHours : [hour],
    typicalLoginDays: computedTypicalDays.length > 0 ? computedTypicalDays : [day],
    averageLoginFrequency: Math.round(avgFrequency * 100) / 100,
    lastUpdated: new Date().toISOString(),
  };

  profileStore.set(key, profile);
  return profile;
}

/** 사용자 행동 프로필 조회 */
export function getUserProfile(tenantId: string, userId: string): UserBehaviorProfile | undefined {
  return profileStore.get(`${tenantId}:${userId}`);
}

// -- 위험도 스코어링 ──────────────────────────────────────────────────────────

/** 거리 계산 (Haversine) */
function calculateDistance(loc1: GeoLocation, loc2: GeoLocation): number {
  const R = 6371; // km
  const dLat = (loc2.latitude - loc1.latitude) * Math.PI / 180;
  const dLon = (loc2.longitude - loc1.longitude) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(loc1.latitude * Math.PI / 180) * Math.cos(loc2.latitude * Math.PI / 180) *
    Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/** 위험도 스코어 계산 -- FR-N288.2, FR-N288.3 */
export function calculateRiskScore(
  event: LoginEvent,
  profile?: UserBehaviorProfile,
): RiskScore {
  const factors: RiskFactor[] = [];

  // 프로필 없음 = 첫 로그인 → 중간 위험
  if (!profile) {
    factors.push({
      factorId: 'f-new-user',
      category: 'behavior',
      description: '신규 사용자 또는 프로필 미구축',
      weight: 0.3,
      score: 50,
    });
  } else {
    // IP 검사
    const knownIP = profile.typicalIPs.includes(event.ipAddress);
    factors.push({
      factorId: 'f-ip',
      category: 'ip',
      description: knownIP ? '알려진 IP에서 접속' : '새로운 IP에서 접속',
      weight: 0.2,
      score: knownIP ? 0 : 70,
    });

    // 디바이스 검사
    const knownDevice = profile.typicalDevices.includes(event.deviceFingerprint);
    factors.push({
      factorId: 'f-device',
      category: 'device',
      description: knownDevice ? '알려진 디바이스' : '새로운 디바이스',
      weight: 0.2,
      score: knownDevice ? 0 : 60,
    });

    // 위치 검사
    const minDistance = profile.typicalLocations.reduce((min, loc) => {
      const dist = calculateDistance(event.geoLocation, loc);
      return dist < min ? dist : min;
    }, Infinity);
    const locationScore = minDistance > 1000 ? 90 :
      minDistance > 500 ? 70 :
        minDistance > 100 ? 40 : 0;
    factors.push({
      factorId: 'f-location',
      category: 'location',
      description: minDistance > 500 ? '비정상적으로 먼 위치' : '정상 범위 위치',
      weight: 0.25,
      score: locationScore,
    });

    // 시간대 검사
    const hour = new Date(event.timestamp).getHours();
    const typicalHour = profile.typicalLoginHours.includes(hour);
    factors.push({
      factorId: 'f-time',
      category: 'time',
      description: typicalHour ? '일반적인 로그인 시간' : '비정상적인 로그인 시간',
      weight: 0.15,
      score: typicalHour ? 0 : 50,
    });

    // 빈도 검사 (연속 실패)
    const key = `${event.tenantId}:${event.userId}`;
    const history = loginHistory.get(key) ?? [];
    const recentFails = history
      .filter(e => !e.success)
      .filter(e => Date.now() - new Date(e.timestamp).getTime() < 30 * 60 * 1000)
      .length;
    factors.push({
      factorId: 'f-frequency',
      category: 'frequency',
      description: recentFails > 3 ? `최근 30분 내 ${recentFails}회 실패` : '정상 빈도',
      weight: 0.2,
      score: recentFails > 5 ? 100 : recentFails > 3 ? 70 : recentFails > 1 ? 30 : 0,
    });
  }

  // 종합 점수 계산
  const totalWeight = factors.reduce((sum, f) => sum + f.weight, 0);
  const overallScore = Math.round(
    factors.reduce((sum, f) => sum + f.score * f.weight, 0) / Math.max(0.01, totalWeight),
  );

  // 위험 수준 결정
  let riskLevel: RiskScore['riskLevel'] = 'safe';
  if (overallScore >= 80) riskLevel = 'critical';
  else if (overallScore >= 60) riskLevel = 'high';
  else if (overallScore >= 40) riskLevel = 'medium';
  else if (overallScore >= 20) riskLevel = 'low';

  const recommendation = riskLevel === 'critical' ? '즉시 차단 및 관리자 알림' :
    riskLevel === 'high' ? 'MFA 추가 인증 필요' :
      riskLevel === 'medium' ? '모니터링 강화 권고' :
        '정상 접근';

  const result: RiskScore = {
    eventId: event.eventId,
    userId: event.userId,
    overallScore,
    factors,
    riskLevel,
    recommendation,
    calculatedAt: new Date().toISOString(),
  };

  recordAudit({
    actor: 'system',
    tenantId: event.tenantId,
    action: 'RISK_SCORE_CALCULATED',
    target: event.eventId,
    details: {
      userId: event.userId,
      ip: maskIP(event.ipAddress),
      overallScore,
      riskLevel,
    },
  });

  return result;
}

// -- 적응형 인증 ──────────────────────────────────────────────────────────────

/** 적응형 인증 트리거 -- FR-N288.4 */
export function triggerAdaptiveAuth(
  event: LoginEvent,
  riskScore: RiskScore,
): AdaptiveAuthTrigger {
  let action: AdaptiveAuthTrigger['action'] = 'allow';
  let reason = '정상 접근';

  if (riskScore.riskLevel === 'critical') {
    action = 'block';
    reason = `위험도 ${riskScore.overallScore}점: ${riskScore.recommendation}`;
  } else if (riskScore.riskLevel === 'high') {
    action = 'mfa_required';
    reason = `위험도 ${riskScore.overallScore}점: 추가 인증 필요`;
  } else if (riskScore.riskLevel === 'medium') {
    action = 'notify_admin';
    reason = `위험도 ${riskScore.overallScore}점: 모니터링 필요`;
  }

  const trigger: AdaptiveAuthTrigger = {
    triggerId: `trigger-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    eventId: event.eventId,
    userId: event.userId,
    action,
    riskLevel: riskScore.riskLevel,
    reason,
    triggeredAt: new Date().toISOString(),
  };

  recordAudit({
    actor: 'system',
    tenantId: event.tenantId,
    action: 'ADAPTIVE_AUTH_TRIGGERED',
    target: event.eventId,
    details: {
      userId: event.userId,
      authAction: action,
      riskLevel: riskScore.riskLevel,
    },
  });

  return trigger;
}

// -- 보안 알림 ────────────────────────────────────────────────────────────────

/** 보안 알림 생성 -- FR-N288.5 */
export function createSecurityAlert(
  event: LoginEvent,
  riskScore: RiskScore,
): SecurityAlert | undefined {
  if (riskScore.riskLevel === 'safe' || riskScore.riskLevel === 'low') {
    return undefined; // 알림 불필요
  }

  const severity: SecurityAlert['severity'] =
    riskScore.riskLevel === 'critical' ? 'critical' :
      riskScore.riskLevel === 'high' ? 'warning' : 'info';

  const alert: SecurityAlert = {
    alertId: `alert-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    tenantId: event.tenantId,
    userId: event.userId,
    severity,
    title: `이상 로그인 감지: ${event.userId}`,
    description: `위험도 ${riskScore.overallScore}점. IP: ${maskIP(event.ipAddress)}, 위치: ${event.geoLocation.city}`,
    riskScore: riskScore.overallScore,
    actions: riskScore.factors.filter(f => f.score > 50).map(f => f.description),
    createdAt: new Date().toISOString(),
  };

  recordAudit({
    actor: 'system',
    tenantId: event.tenantId,
    action: 'SECURITY_ALERT_CREATED',
    target: alert.alertId,
    details: { severity, riskScore: riskScore.overallScore, userId: event.userId },
  });

  return alert;
}

/** 이상 로그인 탐지 서비스 */
export class AnomalyLoginDetectorService {
  constructor(private readonly tenantId: string) {}

  processLogin(event: Omit<LoginEvent, 'tenantId'>): {
    riskScore: RiskScore;
    authTrigger: AdaptiveAuthTrigger;
    alert?: SecurityAlert;
  } {
    const fullEvent: LoginEvent = { ...event, tenantId: this.tenantId };
    const profile = getUserProfile(this.tenantId, event.userId);
    updateBehaviorProfile(fullEvent);
    const riskScore = calculateRiskScore(fullEvent, profile);
    const authTrigger = triggerAdaptiveAuth(fullEvent, riskScore);
    const alert = createSecurityAlert(fullEvent, riskScore);
    return { riskScore, authTrigger, alert };
  }

  getProfile(userId: string): UserBehaviorProfile | undefined {
    return getUserProfile(this.tenantId, userId);
  }

  getAuditLog(): readonly LoginAuditEntry[] {
    return getLoginAuditLog(this.tenantId);
  }
}
