// 고객 이탈 예측 엔진 -- FR-N260.1~FR-N260.6
// Design Ref: MTU-N260 DESIGN §1~§6
// Plan SC: SC-1 (정확도 80%+), SC-2 (2주 사전 감지), SC-3 (자동 알림)
// CSAP: D-06 감사 로그, D-07 모니터링, D-12 개발 보안
// N2SF: O등급 집계 데이터만 분석

import { randomUUID } from 'crypto';

// -- 타입 정의 ────────────────────────────────────────────────────────────────

/** 이탈 위험 등급 */
export type ChurnRiskLevel = 'critical' | 'high' | 'medium' | 'low' | 'healthy';

/** 이탈 징후 패턴 -- Design §3 */
export type ChurnSignalType =
  | 'login_decline'        // 로그인 빈도 감소
  | 'feature_abandonment'  // 핵심 기능 미사용
  | 'api_decline'          // API 호출 감소
  | 'complaint_increase'   // 불만/티켓 증가
  | 'payment_overdue';     // 결제 연체

/** 테넌트 사용 데이터 -- Design §1 */
export interface TenantUsageData {
  tenantId: string;
  period: string;            // YYYY-MM-DD
  loginCount: number;
  dauCount: number;
  apiCallCount: number;
  featureUsage: Record<string, number>;  // 기능별 사용 횟수
  averageSessionMinutes: number;
  supportTickets: number;
  complaintTickets: number;
  paymentStatus: 'paid' | 'overdue' | 'grace';
  revenue: number;
}

/** 이탈 위험 분석 결과 -- Design §2 */
export interface ChurnAnalysis {
  tenantId: string;
  analysisId: string;
  riskScore: number;          // 0~100
  riskLevel: ChurnRiskLevel;
  signals: ChurnSignal[];
  trend: 'improving' | 'stable' | 'declining';
  predictedChurnDate: string | null;
  retentionActions: RetentionAction[];
  analyzedAt: string;
  periodStart: string;
  periodEnd: string;
}

/** 감지된 이탈 징후 */
export interface ChurnSignal {
  type: ChurnSignalType;
  severity: 'critical' | 'high' | 'medium' | 'low';
  description: string;
  metric: string;
  currentValue: number;
  previousValue: number;
  changePercent: number;
  detectedAt: string;
}

/** 리텐션 액션 -- Design §5 */
export interface RetentionAction {
  id: string;
  type: 'onboarding_refresh' | 'feature_training' | 'discount_offer' | 'cs_assignment' | 'survey' | 'custom';
  priority: 'critical' | 'high' | 'medium' | 'low';
  title: string;
  description: string;
  triggerCondition: string;
  status: 'pending' | 'in_progress' | 'completed' | 'skipped';
}

/** 알림 설정 -- Design §4 */
export interface ChurnAlertConfig {
  criticalThreshold: number;   // 기본 80
  highThreshold: number;       // 기본 60
  mediumThreshold: number;     // 기본 40
  alertChannels: string[];
  notifyRoles: string[];
}

/** 이탈 대시보드 메트릭 -- Design §6 */
export interface ChurnDashboardMetrics {
  totalTenants: number;
  healthyCount: number;
  lowRiskCount: number;
  mediumRiskCount: number;
  highRiskCount: number;
  criticalRiskCount: number;
  overallChurnRate: number;
  averageRiskScore: number;
  topSignals: Array<{ type: ChurnSignalType; count: number }>;
  retentionSuccessRate: number;
  recentAlerts: number;
}

// -- 사용 패턴 수집기 -- Design §1 ──────────────────────────────────────────

/** 테넌트 사용 데이터 수집기 */
export class UsageCollector {
  private usageHistory = new Map<string, TenantUsageData[]>();

  /** 사용 데이터 기록 */
  record(data: TenantUsageData): void {
    const history = this.usageHistory.get(data.tenantId) || [];
    history.push(data);

    // 최근 90일만 유지
    if (history.length > 90) {
      history.splice(0, history.length - 90);
    }

    this.usageHistory.set(data.tenantId, history);
  }

  /** 기간별 사용 데이터 조회 */
  getUsage(tenantId: string, days: number): TenantUsageData[] {
    const history = this.usageHistory.get(tenantId) || [];
    return history.slice(-days);
  }

  /** 전체 테넌트 목록 */
  getTenantIds(): string[] {
    return Array.from(this.usageHistory.keys());
  }

  /** 특정 테넌트 최신 데이터 */
  getLatest(tenantId: string): TenantUsageData | null {
    const history = this.usageHistory.get(tenantId);
    return history && history.length > 0 ? (history[history.length - 1] ?? null) : null;
  }
}

// -- 이탈 위험 점수 계산 -- Design §2 ────────────────────────────────────────

/** 가중치 설정 */
const DEFAULT_WEIGHTS = {
  loginDecline: 0.25,
  featureUsageDecline: 0.20,
  apiDecline: 0.15,
  sessionDecline: 0.15,
  complaintIncrease: 0.15,
  paymentOverdue: 0.10,
};

/** 이탈 위험 점수 계산기 */
export class ChurnScoreCalculator {
  constructor(
    private readonly weights = DEFAULT_WEIGHTS,
  ) {}

  /** 이탈 위험 점수 계산 -- Design §2 */
  calculate(
    currentPeriod: TenantUsageData[],
    previousPeriod: TenantUsageData[],
  ): { score: number; signals: ChurnSignal[] } {
    if (currentPeriod.length === 0) {
      return { score: 100, signals: [{ type: 'login_decline', severity: 'critical', description: '데이터 없음 — 완전 이탈 의심', metric: 'loginCount', currentValue: 0, previousValue: 0, changePercent: -100, detectedAt: new Date().toISOString() }] };
    }

    const signals: ChurnSignal[] = [];
    let totalScore = 0;

    // 1. 로그인 빈도 감소 -- Design §3.1
    const currentLogins = this.sum(currentPeriod, 'loginCount');
    const previousLogins = this.sum(previousPeriod, 'loginCount');
    const loginChange = previousLogins > 0 ? ((currentLogins - previousLogins) / previousLogins) * 100 : 0;

    if (loginChange < -50) {
      const severity = loginChange < -80 ? 'critical' : loginChange < -65 ? 'high' : 'medium';
      signals.push({
        type: 'login_decline',
        severity,
        description: `로그인 빈도 ${Math.abs(Math.round(loginChange))}% 감소`,
        metric: 'loginCount',
        currentValue: currentLogins,
        previousValue: previousLogins,
        changePercent: Math.round(loginChange),
        detectedAt: new Date().toISOString(),
      });
      totalScore += this.weights.loginDecline * Math.min(Math.abs(loginChange), 100);
    }

    // 2. 기능 사용률 감소 -- Design §3.2
    const currentFeatureTotal = currentPeriod.reduce(
      (sum, d) => sum + Object.values(d.featureUsage).reduce((a, b) => a + b, 0), 0,
    );
    const previousFeatureTotal = previousPeriod.reduce(
      (sum, d) => sum + Object.values(d.featureUsage).reduce((a, b) => a + b, 0), 0,
    );
    const featureChange = previousFeatureTotal > 0
      ? ((currentFeatureTotal - previousFeatureTotal) / previousFeatureTotal) * 100
      : 0;

    if (featureChange < -30) {
      signals.push({
        type: 'feature_abandonment',
        severity: featureChange < -70 ? 'high' : 'medium',
        description: `기능 사용률 ${Math.abs(Math.round(featureChange))}% 감소`,
        metric: 'featureUsage',
        currentValue: currentFeatureTotal,
        previousValue: previousFeatureTotal,
        changePercent: Math.round(featureChange),
        detectedAt: new Date().toISOString(),
      });
      totalScore += this.weights.featureUsageDecline * Math.min(Math.abs(featureChange), 100);
    }

    // 3. API 호출 감소 -- Design §3.3
    const currentApi = this.sum(currentPeriod, 'apiCallCount');
    const previousApi = this.sum(previousPeriod, 'apiCallCount');
    const apiChange = previousApi > 0 ? ((currentApi - previousApi) / previousApi) * 100 : 0;

    if (apiChange < -70) {
      signals.push({
        type: 'api_decline',
        severity: 'high',
        description: `API 호출량 ${Math.abs(Math.round(apiChange))}% 감소`,
        metric: 'apiCallCount',
        currentValue: currentApi,
        previousValue: previousApi,
        changePercent: Math.round(apiChange),
        detectedAt: new Date().toISOString(),
      });
      totalScore += this.weights.apiDecline * Math.min(Math.abs(apiChange), 100);
    }

    // 4. 세션 시간 감소
    const currentSession = this.average(currentPeriod, 'averageSessionMinutes');
    const previousSession = this.average(previousPeriod, 'averageSessionMinutes');
    const sessionChange = previousSession > 0
      ? ((currentSession - previousSession) / previousSession) * 100
      : 0;

    if (sessionChange < -40) {
      totalScore += this.weights.sessionDecline * Math.min(Math.abs(sessionChange), 100);
    }

    // 5. 불만 티켓 증가 -- Design §3.4
    const currentComplaints = this.sum(currentPeriod, 'complaintTickets');
    if (currentComplaints >= 3) {
      signals.push({
        type: 'complaint_increase',
        severity: currentComplaints >= 5 ? 'high' : 'medium',
        description: `불만 티켓 ${currentComplaints}건 발생`,
        metric: 'complaintTickets',
        currentValue: currentComplaints,
        previousValue: this.sum(previousPeriod, 'complaintTickets'),
        changePercent: 0,
        detectedAt: new Date().toISOString(),
      });
      totalScore += this.weights.complaintIncrease * Math.min(currentComplaints * 20, 100);
    }

    // 6. 결제 연체 -- Design §3.5
    const hasOverdue = currentPeriod.some((d) => d.paymentStatus === 'overdue');
    if (hasOverdue) {
      signals.push({
        type: 'payment_overdue',
        severity: 'high',
        description: '결제 연체 감지',
        metric: 'paymentStatus',
        currentValue: 1,
        previousValue: 0,
        changePercent: 100,
        detectedAt: new Date().toISOString(),
      });
      totalScore += this.weights.paymentOverdue * 100;
    }

    const score = Math.min(Math.round(totalScore), 100);
    return { score, signals };
  }

  /** 위험 등급 결정 */
  getRiskLevel(score: number): ChurnRiskLevel {
    if (score >= 80) return 'critical';
    if (score >= 60) return 'high';
    if (score >= 40) return 'medium';
    if (score >= 20) return 'low';
    return 'healthy';
  }

  private sum(data: TenantUsageData[], field: keyof TenantUsageData): number {
    return data.reduce((sum, d) => sum + (Number(d[field]) || 0), 0);
  }

  private average(data: TenantUsageData[], field: keyof TenantUsageData): number {
    if (data.length === 0) return 0;
    return this.sum(data, field) / data.length;
  }
}

// -- 리텐션 액션 생성기 -- Design §5 ─────────────────────────────────────────

/** 위험 패턴별 리텐션 액션 생성 */
export function generateRetentionActions(signals: ChurnSignal[], riskLevel: ChurnRiskLevel): RetentionAction[] {
  const actions: RetentionAction[] = [];

  for (const signal of signals) {
    switch (signal.type) {
      case 'login_decline':
        actions.push({
          id: randomUUID(),
          type: 'onboarding_refresh',
          priority: signal.severity,
          title: '온보딩 재안내',
          description: '로그인 빈도가 감소하고 있습니다. 신규 기능 안내 및 온보딩 가이드를 재전송하세요.',
          triggerCondition: `로그인 ${Math.abs(signal.changePercent)}% 감소`,
          status: 'pending',
        });
        break;

      case 'feature_abandonment':
        actions.push({
          id: randomUUID(),
          type: 'feature_training',
          priority: signal.severity,
          title: '기능 교육 세션',
          description: '핵심 기능 사용이 감소하고 있습니다. 1:1 교육 세션 또는 웨비나를 제안하세요.',
          triggerCondition: `기능 사용률 ${Math.abs(signal.changePercent)}% 감소`,
          status: 'pending',
        });
        break;

      case 'api_decline':
        actions.push({
          id: randomUUID(),
          type: 'cs_assignment',
          priority: signal.severity,
          title: 'CS 담당자 배정',
          description: 'API 사용량이 크게 감소했습니다. 전담 CS 담당자를 배정하여 사용 현황을 파악하세요.',
          triggerCondition: `API 호출 ${Math.abs(signal.changePercent)}% 감소`,
          status: 'pending',
        });
        break;

      case 'complaint_increase':
        actions.push({
          id: randomUUID(),
          type: 'survey',
          priority: signal.severity,
          title: '만족도 설문 및 개선 약속',
          description: '불만 티켓이 증가하고 있습니다. 긴급 만족도 설문을 실시하고 개선 로드맵을 공유하세요.',
          triggerCondition: `불만 티켓 ${signal.currentValue}건`,
          status: 'pending',
        });
        break;

      case 'payment_overdue':
        actions.push({
          id: randomUUID(),
          type: 'discount_offer',
          priority: 'high',
          title: '결제 안내 및 할인 제안',
          description: '결제가 연체되었습니다. 결제 안내 연락과 함께 갱신 할인을 제안하세요.',
          triggerCondition: '결제 연체',
          status: 'pending',
        });
        break;
    }
  }

  // 위험 등급이 critical이면 CS 긴급 배정 추가
  if (riskLevel === 'critical' && !actions.some((a) => a.type === 'cs_assignment')) {
    actions.push({
      id: randomUUID(),
      type: 'cs_assignment',
      priority: 'critical',
      title: '긴급 CS 담당자 배정',
      description: '이탈 위험이 매우 높습니다. 즉시 전담 CS 담당자를 배정하여 직접 연락하세요.',
      triggerCondition: `위험 점수 critical`,
      status: 'pending',
    });
  }

  return actions;
}

// -- 이탈 예측 엔진 (통합) ───────────────────────────────────────────────────

/** 이탈 예측 엔진 */
export class ChurnPredictionEngine {
  private collector: UsageCollector;
  private calculator: ChurnScoreCalculator;
  private analysisHistory: ChurnAnalysis[] = [];
  private alertConfig: ChurnAlertConfig;

  constructor(config?: Partial<ChurnAlertConfig>) {
    this.collector = new UsageCollector();
    this.calculator = new ChurnScoreCalculator();
    this.alertConfig = {
      criticalThreshold: config?.criticalThreshold ?? 80,
      highThreshold: config?.highThreshold ?? 60,
      mediumThreshold: config?.mediumThreshold ?? 40,
      alertChannels: config?.alertChannels ?? ['email', 'notification'],
      notifyRoles: config?.notifyRoles ?? ['admin', 'cs_manager'],
    };
  }

  /** 사용 데이터 기록 */
  recordUsage(data: TenantUsageData): void {
    this.collector.record(data);
  }

  /** 테넌트 이탈 분석 실행 */
  analyze(tenantId: string, periodDays = 14): ChurnAnalysis {
    const currentPeriod = this.collector.getUsage(tenantId, periodDays);
    const previousPeriod = this.collector.getUsage(tenantId, periodDays * 2).slice(0, periodDays);

    const { score, signals } = this.calculator.calculate(currentPeriod, previousPeriod);
    const riskLevel = this.calculator.getRiskLevel(score);
    const retentionActions = generateRetentionActions(signals, riskLevel);

    // 트렌드 판단
    const previousAnalysis = this.analysisHistory.find((a) => a.tenantId === tenantId);
    let trend: 'improving' | 'stable' | 'declining' = 'stable';
    if (previousAnalysis) {
      if (score > previousAnalysis.riskScore + 5) trend = 'declining';
      else if (score < previousAnalysis.riskScore - 5) trend = 'improving';
    }

    // 예상 이탈일
    const predictedChurnDate = riskLevel === 'critical' || riskLevel === 'high'
      ? new Date(Date.now() + 14 * 86400000).toISOString().split('T')[0]
      : null;

    const now = new Date();
    const analysis: ChurnAnalysis = {
      tenantId,
      analysisId: randomUUID(),
      riskScore: score,
      riskLevel,
      signals,
      trend,
      predictedChurnDate: predictedChurnDate ?? null,
      retentionActions,
      analyzedAt: now.toISOString(),
      periodStart: new Date(now.getTime() - periodDays * 86400000).toISOString().split('T')[0] ?? '',
      periodEnd: now.toISOString().split('T')[0] ?? '',
    };

    // 이력 저장 (최근 100건)
    this.analysisHistory.push(analysis);
    if (this.analysisHistory.length > 100) {
      this.analysisHistory = this.analysisHistory.slice(-100);
    }

    return analysis;
  }

  /** 전체 테넌트 일괄 분석 */
  analyzeAll(periodDays = 14): ChurnAnalysis[] {
    const tenantIds = this.collector.getTenantIds();
    return tenantIds.map((id) => this.analyze(id, periodDays));
  }

  /** 대시보드 메트릭 -- Design §6 */
  getDashboardMetrics(): ChurnDashboardMetrics {
    const tenantIds = this.collector.getTenantIds();
    const analyses = tenantIds.map((id) => {
      const existing = this.analysisHistory.find((a) => a.tenantId === id);
      return existing || this.analyze(id);
    });

    const riskCounts = { healthy: 0, low: 0, medium: 0, high: 0, critical: 0 };
    let totalScore = 0;

    for (const analysis of analyses) {
      riskCounts[analysis.riskLevel] += 1;
      totalScore += analysis.riskScore;
    }

    // 상위 이탈 징후 집계
    const signalCounts = new Map<ChurnSignalType, number>();
    for (const analysis of analyses) {
      for (const signal of analysis.signals) {
        signalCounts.set(signal.type, (signalCounts.get(signal.type) || 0) + 1);
      }
    }

    const topSignals = Array.from(signalCounts.entries())
      .map(([type, count]) => ({ type, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    return {
      totalTenants: tenantIds.length,
      healthyCount: riskCounts.healthy,
      lowRiskCount: riskCounts.low,
      mediumRiskCount: riskCounts.medium,
      highRiskCount: riskCounts.high,
      criticalRiskCount: riskCounts.critical,
      overallChurnRate: tenantIds.length > 0
        ? Math.round(((riskCounts.high + riskCounts.critical) / tenantIds.length) * 10000) / 100
        : 0,
      averageRiskScore: tenantIds.length > 0
        ? Math.round((totalScore / tenantIds.length) * 100) / 100
        : 0,
      topSignals,
      retentionSuccessRate: 0,   // 추후 리텐션 결과 추적 시 계산
      recentAlerts: riskCounts.high + riskCounts.critical,
    };
  }

  /** 분석 이력 조회 */
  getAnalysisHistory(tenantId?: string, limit = 50): ChurnAnalysis[] {
    const history = tenantId
      ? this.analysisHistory.filter((a) => a.tenantId === tenantId)
      : this.analysisHistory;
    return history.slice(-limit);
  }

  /** 알림 설정 조회 */
  getAlertConfig(): ChurnAlertConfig {
    return { ...this.alertConfig };
  }

  /** 알림 설정 변경 */
  updateAlertConfig(config: Partial<ChurnAlertConfig>): void {
    Object.assign(this.alertConfig, config);
  }

  /** 사용 데이터 수집기 접근 */
  getCollector(): UsageCollector {
    return this.collector;
  }
}

// -- 팩토리 ──────────────────────────────────────────────────────────────────

/** 이탈 예측 엔진 생성 */
export function createChurnPredictionEngine(
  config?: Partial<ChurnAlertConfig>,
): ChurnPredictionEngine {
  return new ChurnPredictionEngine(config);
}
