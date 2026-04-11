// 고객 성공(CS) AI 자동화 -- FR-N270.1~FR-N270.6
// Design Ref: MTU-N270 DESIGN §1~§6
// CSAP: D-06 감사, D-08 접근 통제, D-12 개발 보안
// N2SF: 집계 사용 패턴만 분석 (O등급), PII 마스킹 필수

import { randomUUID } from 'crypto';

// -- 타입 정의 ────────────────────────────────────────────────────────────────

/** 고객 여정 단계 -- Design §4 */
export type CustomerJourneyStage =
  | 'onboarding'
  | 'activation'
  | 'engagement'
  | 'expansion'
  | 'renewal';

/** 위험 등급 -- Design §2 */
export type RiskLevel = 'low' | 'medium' | 'high' | 'critical';

/** 인터벤션 유형 -- Design §3 */
export type InterventionType =
  | 'automated_email'
  | 'in_app_guide'
  | 'meeting_request'
  | 'training_offer'
  | 'executive_outreach'
  | 'custom';

/** 고객 활동 지표 -- Design §1 */
export interface CustomerActivityMetrics {
  tenantId: string;
  activeUsers: number;
  totalUsers: number;
  loginFrequency: number;
  featureAdoptionRate: number;
  supportTickets: number;
  avgSessionDuration: number;
  lastLoginAt: string;
  measurementDate: string;
}

/** 헬스 스코어 결과 -- Design §1 */
export interface HealthScoreResult {
  tenantId: string;
  overallScore: number;
  components: HealthScoreComponent[];
  trend: 'improving' | 'stable' | 'declining';
  riskLevel: RiskLevel;
  calculatedAt: string;
}

/** 헬스 스코어 구성 요소 */
export interface HealthScoreComponent {
  name: string;
  weight: number;
  score: number;
  weightedScore: number;
}

/** 이탈 위험 분석 -- Design §2 */
export interface ChurnRiskAssessment {
  tenantId: string;
  riskLevel: RiskLevel;
  riskScore: number;
  riskFactors: RiskFactor[];
  predictedChurnProbability: number;
  assessedAt: string;
}

/** 위험 요인 */
export interface RiskFactor {
  factor: string;
  severity: RiskLevel;
  description: string;
  suggestedAction: string;
}

/** 인터벤션 플레이북 -- Design §3 */
export interface InterventionPlaybook {
  id: string;
  name: string;
  triggerCondition: PlaybookTrigger;
  actions: InterventionAction[];
  isActive: boolean;
  createdAt: string;
}

/** 플레이북 트리거 조건 */
export interface PlaybookTrigger {
  riskLevel?: RiskLevel;
  healthScoreBelow?: number;
  journeyStage?: CustomerJourneyStage;
  inactiveDays?: number;
}

/** 인터벤션 액션 */
export interface InterventionAction {
  id: string;
  type: InterventionType;
  template: string;
  delayDays: number;
  priority: number;
}

/** 인터벤션 실행 기록 */
export interface InterventionExecution {
  id: string;
  playbookId: string;
  tenantId: string;
  actionType: InterventionType;
  status: 'pending' | 'executed' | 'skipped';
  executedAt: string;
}

/** NPS/CSAT 예측 -- Design §5 */
export interface SatisfactionPrediction {
  tenantId: string;
  predictedNPS: number;
  predictedCSAT: number;
  confidence: number;
  keyDrivers: string[];
  predictedAt: string;
}

/** 감사 항목 */
export interface CSAuditEntry {
  id: string;
  action: string;
  actor: string;
  tenantId?: string;
  details: Record<string, unknown>;
  timestamp: string;
}

// -- 감사 로그 ────────────────────────────────────────────────────────────────

const auditLog: CSAuditEntry[] = [];

function recordAudit(action: string, actor: string, details: Record<string, unknown>): void {
  auditLog.push({
    id: randomUUID(),
    action,
    actor,
    tenantId: details.tenantId as string | undefined,
    details,
    timestamp: new Date().toISOString(),
  });
}

export function getCSAuditLog(): CSAuditEntry[] {
  return [...auditLog];
}

// -- §1 헬스 스코어 산출 ─────────────────────────────────────────────────────

/** 헬스 스코어 가중치 설정 */
const HEALTH_WEIGHTS = {
  userActivity: 0.25,
  featureAdoption: 0.20,
  engagement: 0.20,
  supportHealth: 0.15,
  recency: 0.20,
};

/** 고객 헬스 스코어 산출 -- FR-N270.1 */
export function calculateHealthScore(
  metrics: CustomerActivityMetrics,
  historicalScores: number[],
  actor: string
): HealthScoreResult {
  const components: HealthScoreComponent[] = [];

  // 사용자 활성도
  const userActivityScore = metrics.totalUsers > 0
    ? Math.min(100, (metrics.activeUsers / metrics.totalUsers) * 100)
    : 0;
  components.push({
    name: '사용자 활성도',
    weight: HEALTH_WEIGHTS.userActivity,
    score: userActivityScore,
    weightedScore: userActivityScore * HEALTH_WEIGHTS.userActivity,
  });

  // 기능 채택률
  const featureScore = Math.min(100, metrics.featureAdoptionRate * 100);
  components.push({
    name: '기능 채택률',
    weight: HEALTH_WEIGHTS.featureAdoption,
    score: featureScore,
    weightedScore: featureScore * HEALTH_WEIGHTS.featureAdoption,
  });

  // 참여도 (로그인 빈도 + 세션 시간)
  const engagementScore = Math.min(100,
    (metrics.loginFrequency / 20) * 50 +
    (metrics.avgSessionDuration / 30) * 50
  );
  components.push({
    name: '참여도',
    weight: HEALTH_WEIGHTS.engagement,
    score: engagementScore,
    weightedScore: engagementScore * HEALTH_WEIGHTS.engagement,
  });

  // 지원 건강도 (낮은 티켓 수 = 건강)
  const supportScore = Math.max(0, 100 - metrics.supportTickets * 10);
  components.push({
    name: '지원 건강도',
    weight: HEALTH_WEIGHTS.supportHealth,
    score: supportScore,
    weightedScore: supportScore * HEALTH_WEIGHTS.supportHealth,
  });

  // 최신성 (최근 로그인)
  const daysSinceLogin = Math.max(0,
    (Date.now() - new Date(metrics.lastLoginAt).getTime()) / (1000 * 60 * 60 * 24)
  );
  const recencyScore = Math.max(0, 100 - daysSinceLogin * 3);
  components.push({
    name: '최신성',
    weight: HEALTH_WEIGHTS.recency,
    score: recencyScore,
    weightedScore: recencyScore * HEALTH_WEIGHTS.recency,
  });

  const overallScore = Math.round(
    components.reduce((sum, c) => sum + c.weightedScore, 0)
  );

  // 추세 분석
  let trend: HealthScoreResult['trend'] = 'stable';
  if (historicalScores.length >= 3) {
    const recent = historicalScores.slice(-3);
    const avgRecent = recent.reduce((a, b) => a + b, 0) / recent.length;
    if (overallScore > avgRecent + 5) trend = 'improving';
    else if (overallScore < avgRecent - 5) trend = 'declining';
  }

  // 위험 등급
  let riskLevel: RiskLevel;
  if (overallScore >= 80) riskLevel = 'low';
  else if (overallScore >= 60) riskLevel = 'medium';
  else if (overallScore >= 40) riskLevel = 'high';
  else riskLevel = 'critical';

  recordAudit('HEALTH_SCORE_CALCULATED', actor, {
    tenantId: metrics.tenantId,
    score: overallScore,
    riskLevel,
  });

  return {
    tenantId: metrics.tenantId,
    overallScore,
    components,
    trend,
    riskLevel,
    calculatedAt: new Date().toISOString(),
  };
}

// -- §2 이탈 위험 식별 ────────────────────────────────────────────────────────

/** 이탈 위험 분석 -- FR-N270.2 */
export function assessChurnRisk(
  healthScore: HealthScoreResult,
  metrics: CustomerActivityMetrics,
  actor: string
): ChurnRiskAssessment {
  const riskFactors: RiskFactor[] = [];

  // 위험 요인 분석
  if (healthScore.overallScore < 40) {
    riskFactors.push({
      factor: '헬스 스코어 위험',
      severity: 'critical',
      description: `헬스 스코어 ${healthScore.overallScore}점 — 심각한 수준`,
      suggestedAction: '즉시 임원 레벨 미팅 요청',
    });
  }

  if (healthScore.trend === 'declining') {
    riskFactors.push({
      factor: '하락 추세',
      severity: 'high',
      description: '최근 3주 연속 헬스 스코어 하락',
      suggestedAction: 'CS 매니저 직접 연락',
    });
  }

  const daysSinceLogin = (Date.now() - new Date(metrics.lastLoginAt).getTime()) / (1000 * 60 * 60 * 24);
  if (daysSinceLogin > 14) {
    riskFactors.push({
      factor: '장기 미접속',
      severity: daysSinceLogin > 30 ? 'critical' : 'high',
      description: `${Math.floor(daysSinceLogin)}일간 미접속`,
      suggestedAction: '재참여 캠페인 발송',
    });
  }

  if (metrics.featureAdoptionRate < 0.3) {
    riskFactors.push({
      factor: '기능 미활용',
      severity: 'medium',
      description: `기능 채택률 ${(metrics.featureAdoptionRate * 100).toFixed(0)}%`,
      suggestedAction: '맞춤형 교육 세션 제안',
    });
  }

  if (metrics.supportTickets > 5) {
    riskFactors.push({
      factor: '높은 지원 요청',
      severity: 'medium',
      description: `최근 지원 티켓 ${metrics.supportTickets}건`,
      suggestedAction: '전담 기술 지원 배정',
    });
  }

  // 이탈 확률 계산
  const riskScore = riskFactors.reduce((sum, rf) => {
    const weights: Record<RiskLevel, number> = { low: 5, medium: 15, high: 25, critical: 40 };
    return sum + weights[rf.severity];
  }, 0);

  const churnProbability = Math.min(1, riskScore / 100);

  let riskLevel: RiskLevel;
  if (churnProbability >= 0.7) riskLevel = 'critical';
  else if (churnProbability >= 0.5) riskLevel = 'high';
  else if (churnProbability >= 0.3) riskLevel = 'medium';
  else riskLevel = 'low';

  recordAudit('CHURN_RISK_ASSESSED', actor, {
    tenantId: metrics.tenantId,
    riskLevel,
    churnProbability,
    factorCount: riskFactors.length,
  });

  return {
    tenantId: metrics.tenantId,
    riskLevel,
    riskScore,
    riskFactors,
    predictedChurnProbability: churnProbability,
    assessedAt: new Date().toISOString(),
  };
}

// -- §3 인터벤션 플레이북 ─────────────────────────────────────────────────────

const playbooks = new Map<string, InterventionPlaybook>();
const executions: InterventionExecution[] = [];

/** 플레이북 등록 -- FR-N270.3 */
export function registerPlaybook(
  name: string,
  trigger: PlaybookTrigger,
  actions: Omit<InterventionAction, 'id'>[],
  actor: string
): InterventionPlaybook {
  const playbook: InterventionPlaybook = {
    id: randomUUID(),
    name,
    triggerCondition: trigger,
    actions: actions.map((a) => ({ ...a, id: randomUUID() })),
    isActive: true,
    createdAt: new Date().toISOString(),
  };

  playbooks.set(playbook.id, playbook);
  recordAudit('PLAYBOOK_REGISTERED', actor, { playbookId: playbook.id, name });
  return playbook;
}

/** 플레이북 트리거 평가 및 실행 -- FR-N270.3 */
export function evaluateAndExecutePlaybooks(
  healthScore: HealthScoreResult,
  churnRisk: ChurnRiskAssessment,
  journeyStage: CustomerJourneyStage,
  actor: string
): InterventionExecution[] {
  const triggered: InterventionExecution[] = [];

  for (const [, playbook] of playbooks) {
    if (!playbook.isActive) continue;

    const { triggerCondition } = playbook;
    let shouldTrigger = false;

    if (triggerCondition.riskLevel && churnRisk.riskLevel === triggerCondition.riskLevel) {
      shouldTrigger = true;
    }
    if (triggerCondition.healthScoreBelow && healthScore.overallScore < triggerCondition.healthScoreBelow) {
      shouldTrigger = true;
    }
    if (triggerCondition.journeyStage && journeyStage === triggerCondition.journeyStage) {
      shouldTrigger = true;
    }

    if (shouldTrigger) {
      for (const action of playbook.actions) {
        const execution: InterventionExecution = {
          id: randomUUID(),
          playbookId: playbook.id,
          tenantId: healthScore.tenantId,
          actionType: action.type,
          status: 'executed',
          executedAt: new Date().toISOString(),
        };
        executions.push(execution);
        triggered.push(execution);
      }
    }
  }

  if (triggered.length > 0) {
    recordAudit('INTERVENTIONS_EXECUTED', actor, {
      tenantId: healthScore.tenantId,
      executionCount: triggered.length,
    });
  }

  return triggered;
}

/** 플레이북 목록 조회 */
export function listPlaybooks(): InterventionPlaybook[] {
  return Array.from(playbooks.values());
}

/** 실행 이력 조회 */
export function getExecutionHistory(tenantId?: string): InterventionExecution[] {
  if (tenantId) {
    return executions.filter((e) => e.tenantId === tenantId);
  }
  return [...executions];
}

// -- §4 고객 여정 단계 분류 ───────────────────────────────────────────────────

/** 고객 여정 단계 자동 분류 -- FR-N270.4 */
export function classifyJourneyStage(
  metrics: CustomerActivityMetrics,
  accountAgeDays: number
): CustomerJourneyStage {
  // 온보딩 (가입 후 30일 이내)
  if (accountAgeDays <= 30) return 'onboarding';

  // 활성화 (기능 채택률 50% 미만이고 60일 이내)
  if (accountAgeDays <= 60 && metrics.featureAdoptionRate < 0.5) return 'activation';

  // 확장 (기능 채택률 70% 이상, 활성 사용자 증가)
  if (metrics.featureAdoptionRate >= 0.7 && metrics.activeUsers > metrics.totalUsers * 0.7) {
    return 'expansion';
  }

  // 갱신 (계약 만료 90일 이내 — 간단 조건으로 1년 주기 가정)
  if (accountAgeDays % 365 > 275) return 'renewal';

  // 참여
  return 'engagement';
}

// -- §5 NPS/CSAT 예측 ────────────────────────────────────────────────────────

/** NPS/CSAT 예측 -- FR-N270.5 */
export function predictSatisfaction(
  healthScore: HealthScoreResult,
  metrics: CustomerActivityMetrics,
  actor: string
): SatisfactionPrediction {
  // 헬스 스코어 기반 NPS 예측 (단순 선형 매핑)
  // NPS: -100 ~ 100, CSAT: 1 ~ 5
  const nps = Math.round((healthScore.overallScore / 100) * 200 - 100);
  const csat = Math.round(((healthScore.overallScore / 100) * 4 + 1) * 10) / 10;

  const keyDrivers: string[] = [];
  for (const component of healthScore.components) {
    if (component.score >= 80) {
      keyDrivers.push(`${component.name} 우수 (${component.score}점)`);
    } else if (component.score < 50) {
      keyDrivers.push(`${component.name} 개선 필요 (${component.score}점)`);
    }
  }

  const confidence = healthScore.overallScore >= 50 ? 0.8 : 0.6;

  recordAudit('SATISFACTION_PREDICTED', actor, {
    tenantId: metrics.tenantId,
    nps,
    csat,
  });

  return {
    tenantId: metrics.tenantId,
    predictedNPS: Math.max(-100, Math.min(100, nps)),
    predictedCSAT: Math.max(1, Math.min(5, csat)),
    confidence,
    keyDrivers,
    predictedAt: new Date().toISOString(),
  };
}
