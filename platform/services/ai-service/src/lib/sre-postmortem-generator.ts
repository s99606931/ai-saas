// SRE 포스트모텀 자동 생성 엔진 -- FR-N292.1~FR-N292.6
// Design Ref: MTU-N292 DESIGN §1~§6
// Plan SC: SC-1 (초안 완성도 85%+), SC-2 (작성 시간 80% 감소), SC-3 (PII 100%), SC-4 (감사 100%)
// CSAP: D-06 감사 로그, D-07 서비스연속성
// N2SF: 인시던트 데이터 O등급, PII 마스킹 필수

// -- 타입 정의 ────────────────────────────────────────────────────────────────

/** 인시던트 심각도 */
export type IncidentSeverity = 'P1' | 'P2' | 'P3' | 'P4';

/** 인시던트 상태 */
export type IncidentStatus = 'detected' | 'investigating' | 'mitigated' | 'resolved' | 'postmortem';

/** 인시던트 정보 */
export interface Incident {
  readonly incidentId: string;
  readonly tenantId: string;
  readonly title: string;
  readonly severity: IncidentSeverity;
  readonly status: IncidentStatus;
  readonly detectedAt: string;
  readonly mitigatedAt?: string;
  readonly resolvedAt?: string;
  readonly affectedServices: string[];
  readonly impactDescription: string;
  readonly responders: string[];
}

/** 인시던트 로그 항목 */
export interface IncidentLogEntry {
  readonly timestamp: string;
  readonly source: 'alert' | 'metric' | 'log' | 'user' | 'system';
  readonly message: string;
  readonly severity: 'info' | 'warning' | 'error' | 'critical';
  readonly metadata?: Record<string, string>;
}

/** 메트릭 이상 */
export interface MetricAnomaly {
  readonly metricName: string;
  readonly normalValue: number;
  readonly anomalyValue: number;
  readonly unit: string;
  readonly detectedAt: string;
  readonly duration: number;       // 분
}

/** 타임라인 이벤트 */
export interface TimelineEvent {
  readonly timestamp: string;
  readonly event: string;
  readonly actor: string;
  readonly type: 'detection' | 'escalation' | 'action' | 'mitigation' | 'resolution' | 'communication';
}

/** 근본원인 분석 */
export interface RootCauseAnalysis {
  readonly primaryCause: string;
  readonly contributingFactors: string[];
  readonly triggerEvent: string;
  readonly fiveWhys: string[];
  readonly confidenceScore: number;
}

/** 액션 아이템 */
export interface PostmortemActionItem {
  readonly actionId: string;
  readonly category: 'prevention' | 'detection' | 'mitigation' | 'process';
  readonly description: string;
  readonly assignee: string;
  readonly priority: 'P1' | 'P2' | 'P3';
  readonly deadline: string;
  readonly status: 'open' | 'in_progress' | 'completed';
}

/** 포스트모텀 문서 */
export interface PostmortemDocument {
  readonly postmortemId: string;
  readonly incidentId: string;
  readonly tenantId: string;
  readonly title: string;
  readonly severity: IncidentSeverity;
  readonly summary: string;
  readonly timeline: TimelineEvent[];
  readonly rootCause: RootCauseAnalysis;
  readonly impact: ImpactAssessment;
  readonly actionItems: PostmortemActionItem[];
  readonly lessonsLearned: string[];
  readonly generatedAt: string;
}

/** 영향 평가 */
export interface ImpactAssessment {
  readonly duration: number;         // 분
  readonly affectedUsers: number;
  readonly affectedServices: string[];
  readonly dataLoss: boolean;
  readonly slaViolation: boolean;
  readonly financialImpact: number;  // 원
}

/** 감사 로그 */
export interface PostmortemAuditEntry {
  readonly timestamp: string;
  readonly actor: string;
  readonly tenantId: string;
  readonly action: string;
  readonly target: string;
  readonly details: Record<string, unknown>;
}

// -- PII 마스킹 ────────────────────────────────────────────────────────────────

function maskPII(text: string): string {
  return text
    .replace(/\d{6}[-]?\d{7}/g, '[주민번호-마스킹]')
    .replace(/\d{3}[-.]?\d{3,4}[-.]?\d{4}/g, '[전화번호-마스킹]')
    .replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, '[이메일-마스킹]')
    .replace(/\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}/g, '[IP-마스킹]');
}

// -- 감사 로그 ────────────────────────────────────────────────────────────────

const auditLog: PostmortemAuditEntry[] = [];

function recordAudit(entry: Omit<PostmortemAuditEntry, 'timestamp'>): void {
  auditLog.push({ ...entry, timestamp: new Date().toISOString() });
}

export function getPostmortemAuditLog(tenantId: string): readonly PostmortemAuditEntry[] {
  return auditLog.filter(e => e.tenantId === tenantId);
}

// -- 인시던트 로그 수집 ──────────────────────────────────────────────────────

/** 인시던트 로그/메트릭 수집 -- FR-N292.1 */
export function collectIncidentData(
  incident: Incident,
  logs: IncidentLogEntry[],
  metrics: MetricAnomaly[],
): { maskedLogs: IncidentLogEntry[]; metrics: MetricAnomaly[] } {
  // PII 마스킹
  const maskedLogs = logs.map(log => ({
    ...log,
    message: maskPII(log.message),
  }));

  recordAudit({
    actor: 'system',
    tenantId: incident.tenantId,
    action: 'INCIDENT_DATA_COLLECTED',
    target: incident.incidentId,
    details: { logCount: logs.length, metricCount: metrics.length },
  });

  return { maskedLogs, metrics };
}

// -- 타임라인 구성 ────────────────────────────────────────────────────────────

/** 이벤트 타임라인 자동 구성 -- FR-N292.2 */
export function buildTimeline(
  incident: Incident,
  logs: IncidentLogEntry[],
  metrics: MetricAnomaly[],
): TimelineEvent[] {
  const events: TimelineEvent[] = [];

  // 감지 이벤트
  events.push({
    timestamp: incident.detectedAt,
    event: `인시던트 감지: ${incident.title}`,
    actor: 'monitoring',
    type: 'detection',
  });

  // 메트릭 이상 이벤트
  for (const metric of metrics) {
    events.push({
      timestamp: metric.detectedAt,
      event: `${metric.metricName} 이상 감지: ${metric.anomalyValue}${metric.unit} (정상: ${metric.normalValue}${metric.unit})`,
      actor: 'metrics',
      type: 'detection',
    });
  }

  // 로그 기반 이벤트 추출
  const criticalLogs = logs.filter(l => l.severity === 'critical' || l.severity === 'error');
  for (const log of criticalLogs.slice(0, 10)) {
    events.push({
      timestamp: log.timestamp,
      event: maskPII(log.message),
      actor: log.source,
      type: 'action',
    });
  }

  // 완화 이벤트
  if (incident.mitigatedAt) {
    events.push({
      timestamp: incident.mitigatedAt,
      event: '인시던트 완화 조치 완료',
      actor: incident.responders.join(', ') || 'SRE',
      type: 'mitigation',
    });
  }

  // 해결 이벤트
  if (incident.resolvedAt) {
    events.push({
      timestamp: incident.resolvedAt,
      event: '인시던트 완전 해결',
      actor: incident.responders.join(', ') || 'SRE',
      type: 'resolution',
    });
  }

  // 시간순 정렬
  return events.sort((a, b) => a.timestamp.localeCompare(b.timestamp));
}

// -- 근본원인 추정 ────────────────────────────────────────────────────────────

/** 근본원인 AI 추정 -- FR-N292.3 */
export function estimateRootCause(
  _incident: Incident,
  logs: IncidentLogEntry[],
  metrics: MetricAnomaly[],
): RootCauseAnalysis {
  // 키워드 기반 원인 추정 (실제로는 LLM 분석)
  const allMessages = logs.map(l => l.message).join(' ').toLowerCase();
  const metricNames = metrics.map(m => m.metricName).join(' ').toLowerCase();

  let primaryCause = '서비스 부하 증가로 인한 성능 저하';
  const contributingFactors: string[] = [];
  let triggerEvent = '트래픽 급증';

  if (allMessages.includes('oom') || allMessages.includes('memory')) {
    primaryCause = '메모리 부족(OOM)으로 인한 서비스 장애';
    triggerEvent = '메모리 사용량 급증';
    contributingFactors.push('메모리 누수 가능성');
    contributingFactors.push('부적절한 리소스 제한 설정');
  } else if (allMessages.includes('timeout') || allMessages.includes('connection')) {
    primaryCause = '데이터베이스 연결 타임아웃으로 인한 서비스 중단';
    triggerEvent = 'DB 커넥션 풀 고갈';
    contributingFactors.push('슬로우 쿼리 누적');
    contributingFactors.push('커넥션 풀 크기 부족');
  } else if (allMessages.includes('disk') || metricNames.includes('disk')) {
    primaryCause = '디스크 용량 부족으로 인한 서비스 장애';
    triggerEvent = '디스크 사용량 100% 도달';
    contributingFactors.push('로그 로테이션 미설정');
    contributingFactors.push('임시 파일 미정리');
  } else if (allMessages.includes('deploy') || allMessages.includes('release')) {
    primaryCause = '배포 후 발생한 서비스 장애';
    triggerEvent = '신규 버전 배포';
    contributingFactors.push('불충분한 테스트');
    contributingFactors.push('롤백 절차 부재');
  }

  if (contributingFactors.length === 0) {
    contributingFactors.push('모니터링 임계값 부적절');
    contributingFactors.push('알림 지연');
  }

  // 5 Whys 분석
  const fiveWhys = [
    `왜 발생했나? → ${primaryCause}`,
    `왜 그것이 문제가 되었나? → ${contributingFactors[0] ?? '리소스 관리 부족'}`,
    `왜 사전에 감지하지 못했나? → 모니터링 커버리지 부족`,
    `왜 빠르게 복구하지 못했나? → 자동 복구 절차 미비`,
    `왜 예방하지 못했나? → 용량 계획 및 부하 테스트 부족`,
  ];

  return {
    primaryCause,
    contributingFactors,
    triggerEvent,
    fiveWhys,
    confidenceScore: metrics.length > 0 && logs.length > 5 ? 0.85 : 0.65,
  };
}

// -- 영향 평가 ────────────────────────────────────────────────────────────────

/** 영향 평가 */
function assessImpact(incident: Incident): ImpactAssessment {
  const detectedTime = new Date(incident.detectedAt).getTime();
  const resolvedTime = incident.resolvedAt
    ? new Date(incident.resolvedAt).getTime()
    : Date.now();
  const durationMinutes = Math.round((resolvedTime - detectedTime) / 60000);

  // 영향 사용자 추정
  const userMultiplier = incident.severity === 'P1' ? 1000 :
    incident.severity === 'P2' ? 500 :
      incident.severity === 'P3' ? 100 : 10;

  return {
    duration: durationMinutes,
    affectedUsers: userMultiplier * incident.affectedServices.length,
    affectedServices: incident.affectedServices,
    dataLoss: false,
    slaViolation: incident.severity === 'P1' || incident.severity === 'P2',
    financialImpact: durationMinutes * 10000, // 분당 1만원 추정
  };
}

// -- 액션 아이템 추출 ────────────────────────────────────────────────────────

/** 액션 아이템 자동 추출 -- FR-N292.5 */
export function extractActionItems(
  rootCause: RootCauseAnalysis,
  impact: ImpactAssessment,
): PostmortemActionItem[] {
  const items: PostmortemActionItem[] = [];
  const now = Date.now();

  // 예방 조치
  items.push({
    actionId: `act-${now}-1`,
    category: 'prevention',
    description: `근본원인 해결: ${rootCause.primaryCause}`,
    assignee: '담당 개발팀',
    priority: 'P1',
    deadline: new Date(now + 7 * 24 * 60 * 60 * 1000).toISOString(),
    status: 'open',
  });

  // 기여 요인 해결
  for (const [idx, factor] of rootCause.contributingFactors.entries()) {
    items.push({
      actionId: `act-${now}-${idx + 2}`,
      category: 'prevention',
      description: `기여 요인 해결: ${factor}`,
      assignee: 'SRE팀',
      priority: idx === 0 ? 'P1' : 'P2',
      deadline: new Date(now + 14 * 24 * 60 * 60 * 1000).toISOString(),
      status: 'open',
    });
  }

  // 탐지 개선
  items.push({
    actionId: `act-${now}-detect`,
    category: 'detection',
    description: '모니터링 임계값 및 알림 규칙 개선',
    assignee: 'SRE팀',
    priority: 'P2',
    deadline: new Date(now + 7 * 24 * 60 * 60 * 1000).toISOString(),
    status: 'open',
  });

  // SLA 위반 시 프로세스 개선
  if (impact.slaViolation) {
    items.push({
      actionId: `act-${now}-process`,
      category: 'process',
      description: '인시던트 대응 절차(runbook) 업데이트',
      assignee: 'SRE 리드',
      priority: 'P2',
      deadline: new Date(now + 14 * 24 * 60 * 60 * 1000).toISOString(),
      status: 'open',
    });
  }

  return items;
}

// -- 포스트모텀 생성 ──────────────────────────────────────────────────────────

/** 포스트모텀 초안 자동 생성 -- FR-N292.4 */
export function generatePostmortem(
  incident: Incident,
  logs: IncidentLogEntry[],
  metrics: MetricAnomaly[],
): PostmortemDocument {
  const { maskedLogs } = collectIncidentData(incident, logs, metrics);
  const timeline = buildTimeline(incident, maskedLogs, metrics);
  const rootCause = estimateRootCause(incident, maskedLogs, metrics);
  const impact = assessImpact(incident);
  const actionItems = extractActionItems(rootCause, impact);

  const summary = [
    `${incident.detectedAt.slice(0, 10)} ${incident.title}`,
    `심각도: ${incident.severity}, 영향 시간: ${impact.duration}분`,
    `영향 서비스: ${incident.affectedServices.join(', ')}`,
    `근본원인: ${rootCause.primaryCause}`,
  ].join('. ');

  const lessonsLearned: string[] = [
    '모니터링 커버리지를 확대하여 조기 감지 능력을 강화해야 합니다',
    '자동 복구(self-healing) 메커니즘을 도입하여 MTTR을 줄여야 합니다',
    '정기적인 장애 대응 훈련을 통해 팀 대응 역량을 향상해야 합니다',
  ];

  if (impact.slaViolation) {
    lessonsLearned.push('SLA 위반 방지를 위한 용량 계획을 강화해야 합니다');
  }

  const postmortem: PostmortemDocument = {
    postmortemId: `pm-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    incidentId: incident.incidentId,
    tenantId: incident.tenantId,
    title: `포스트모텀: ${incident.title}`,
    severity: incident.severity,
    summary,
    timeline,
    rootCause,
    impact,
    actionItems,
    lessonsLearned,
    generatedAt: new Date().toISOString(),
  };

  recordAudit({
    actor: 'system',
    tenantId: incident.tenantId,
    action: 'POSTMORTEM_GENERATED',
    target: postmortem.postmortemId,
    details: {
      incidentId: incident.incidentId,
      severity: incident.severity,
      timelineEvents: timeline.length,
      actionItems: actionItems.length,
    },
  });

  return postmortem;
}

/** SRE 포스트모텀 서비스 */
export class SREPostmortemGeneratorService {
  constructor(private readonly tenantId: string) {}

  generate(
    incident: Omit<Incident, 'tenantId'>,
    logs: IncidentLogEntry[],
    metrics: MetricAnomaly[],
  ): PostmortemDocument {
    return generatePostmortem({ ...incident, tenantId: this.tenantId }, logs, metrics);
  }

  getAuditLog(): readonly PostmortemAuditEntry[] {
    return getPostmortemAuditLog(this.tenantId);
  }
}
