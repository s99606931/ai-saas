// AI 거버넌스 메트릭 수집기 -- FR-ADV37.1~37.4, FR-ADV37.6
// Design Ref: SVC-AI-ADV-R37 DESIGN §1~§4, §6
// Plan SC: SC-1 (메트릭 집계 정확도), SC-4 (윤리 지표)
// CSAP: D-06 AI 감사 메트릭, AI 윤리 준수

// -- 타입 정의 ────────────────────────────────────────────────────────────────

/** AI 호출 이벤트 -- Design §1 */
export interface AICallEvent {
  requestId: string;
  model: string;
  tenantId: string;
  inputTokens: number;
  outputTokens: number;
  latencyMs: number;
  success: boolean;
  errorCode?: string;
  timestamp: string;
}

/** 품질 피드백 이벤트 -- Design §3 */
export interface QualityFeedback {
  requestId: string;
  model: string;
  tenantId: string;
  hallucinationDetected: boolean;
  relevanceScore: number;
  userSatisfaction?: number;
  timestamp: string;
}

/** 윤리 측정 이벤트 -- Design §4 */
export interface EthicsEvent {
  requestId: string;
  model: string;
  category: string;
  biasScore: number;
  explainabilityScore: number;
  timestamp: string;
}

/** 모델 사용 메트릭 집계 -- Design §1 */
export interface ModelUsageMetrics {
  model: string;
  totalCalls: number;
  successCalls: number;
  errorCalls: number;
  errorRate: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  avgLatencyMs: number;
  p95LatencyMs: number;
  period: string;
}

/** 비용 집계 -- Design §2 */
export interface CostMetrics {
  model: string;
  tenantId?: string;
  totalInputTokens: number;
  totalOutputTokens: number;
  inputCost: number;
  outputCost: number;
  totalCost: number;
  period: string;
}

/** 품질 집계 -- Design §3 */
export interface QualityMetrics {
  model: string;
  hallucinationRate: number;
  avgRelevance: number;
  avgSatisfaction: number;
  totalFeedbacks: number;
  period: string;
}

/** AI 윤리 지표 -- Design §4 */
export interface EthicsMetrics {
  avgBiasScore: number;
  avgExplainability: number;
  fairnessIndex: number;
  transparencyRate: number;
  totalEvents: number;
  period: string;
}

/** 알림 규칙 -- Design §6 */
export interface AlertRule {
  id: string;
  metric: string;
  operator: 'gt' | 'lt' | 'gte' | 'lte';
  threshold: number;
  severity: 'critical' | 'high' | 'medium';
  message: string;
  enabled: boolean;
}

/** 알림 */
export interface GovernanceAlert {
  ruleId: string;
  metric: string;
  currentValue: number;
  threshold: number;
  severity: string;
  message: string;
  timestamp: string;
}

/** 모델별 비용 단가 (USD per 1K tokens) */
export interface ModelPricing {
  model: string;
  inputPricePerKToken: number;
  outputPricePerKToken: number;
}

// -- 기본 비용 단가 ──────────────────────────────────────────────────────────

const DEFAULT_PRICING: ModelPricing[] = [
  { model: 'claude-opus-4-6', inputPricePerKToken: 0.015, outputPricePerKToken: 0.075 },
  { model: 'claude-sonnet-4-6', inputPricePerKToken: 0.003, outputPricePerKToken: 0.015 },
  { model: 'claude-haiku-4-5', inputPricePerKToken: 0.00025, outputPricePerKToken: 0.00125 },
  { model: 'gpt-4o', inputPricePerKToken: 0.005, outputPricePerKToken: 0.015 },
  { model: 'local-ollama', inputPricePerKToken: 0, outputPricePerKToken: 0 },
];

const DEFAULT_ALERT_RULES: AlertRule[] = [
  { id: 'AR-001', metric: 'errorRate', operator: 'gt', threshold: 5, severity: 'high', message: '에러율 5% 초과', enabled: true },
  { id: 'AR-002', metric: 'hallucinationRate', operator: 'gt', threshold: 10, severity: 'high', message: '환각률 10% 초과', enabled: true },
  { id: 'AR-003', metric: 'avgLatencyMs', operator: 'gt', threshold: 5000, severity: 'medium', message: '평균 지연시간 5초 초과', enabled: true },
  { id: 'AR-004', metric: 'biasScore', operator: 'gt', threshold: 0.3, severity: 'critical', message: '편향성 점수 0.3 초과', enabled: true },
];

// -- 감사 로그 ────────────────────────────────────────────────────────────────

function auditLog(action: string, details: Record<string, unknown>): void {
  const entry = {
    timestamp: new Date().toISOString(),
    component: 'ai-governance-metrics',
    action,
    ...details,
  };
  console.log(`[AUDIT] ${JSON.stringify(entry)}`);
}

// -- AIGovernanceMetrics 메인 클래스 ──────────────────────────────────────────

/** AI 거버넌스 메트릭 수집기 */
export class AIGovernanceMetrics {
  private callEvents: AICallEvent[] = [];
  private qualityFeedbacks: QualityFeedback[] = [];
  private ethicsEvents: EthicsEvent[] = [];
  private readonly pricing: ModelPricing[];
  private alertRules: AlertRule[];
  private alertCallbacks: ((alert: GovernanceAlert) => void)[] = [];

  constructor(
    pricing?: ModelPricing[],
    alertRules?: AlertRule[],
  ) {
    this.pricing = pricing ?? DEFAULT_PRICING;
    this.alertRules = alertRules ?? DEFAULT_ALERT_RULES;
  }

  // -- 이벤트 수집 ───────────────────────────────────────────────────────

  /** AI 호출 이벤트 기록 */
  recordCall(event: AICallEvent): void {
    this.callEvents.push(event);
  }

  /** 품질 피드백 기록 */
  recordFeedback(feedback: QualityFeedback): void {
    this.qualityFeedbacks.push(feedback);
  }

  /** 윤리 이벤트 기록 */
  recordEthicsEvent(event: EthicsEvent): void {
    this.ethicsEvents.push(event);
  }

  // -- 모델 사용 집계 -- Design §1 ──────────────────────────────────────

  /** 모델 사용 메트릭 집계 */
  getUsageMetrics(
    model?: string,
    periodStart?: string,
    periodEnd?: string,
  ): ModelUsageMetrics[] {
    let filtered = this.callEvents;
    if (model) filtered = filtered.filter((e) => e.model === model);
    if (periodStart) filtered = filtered.filter((e) => e.timestamp >= periodStart);
    if (periodEnd) filtered = filtered.filter((e) => e.timestamp <= periodEnd);

    // 모델별 그룹화
    const byModel = new Map<string, AICallEvent[]>();
    for (const event of filtered) {
      const group = byModel.get(event.model) ?? [];
      group.push(event);
      byModel.set(event.model, group);
    }

    return Array.from(byModel.entries()).map(([modelName, events]) => {
      const success = events.filter((e) => e.success).length;
      const errors = events.length - success;
      const latencies = events.map((e) => e.latencyMs).sort((a, b) => a - b);
      const p95Idx = Math.floor(latencies.length * 0.95);

      return {
        model: modelName,
        totalCalls: events.length,
        successCalls: success,
        errorCalls: errors,
        errorRate: events.length > 0 ? (errors / events.length) * 100 : 0,
        totalInputTokens: events.reduce((s, e) => s + e.inputTokens, 0),
        totalOutputTokens: events.reduce((s, e) => s + e.outputTokens, 0),
        avgLatencyMs: events.length > 0
          ? events.reduce((s, e) => s + e.latencyMs, 0) / events.length
          : 0,
        p95LatencyMs: latencies[p95Idx] ?? 0,
        period: `${periodStart ?? 'all'} ~ ${periodEnd ?? 'now'}`,
      };
    });
  }

  // -- 비용 집계 -- Design §2 ────────────────────────────────────────────

  /** 비용 메트릭 집계 */
  getCostMetrics(
    tenantId?: string,
    periodStart?: string,
    periodEnd?: string,
  ): CostMetrics[] {
    let filtered = this.callEvents;
    if (tenantId) filtered = filtered.filter((e) => e.tenantId === tenantId);
    if (periodStart) filtered = filtered.filter((e) => e.timestamp >= periodStart);
    if (periodEnd) filtered = filtered.filter((e) => e.timestamp <= periodEnd);

    const byModel = new Map<string, AICallEvent[]>();
    for (const event of filtered) {
      const group = byModel.get(event.model) ?? [];
      group.push(event);
      byModel.set(event.model, group);
    }

    return Array.from(byModel.entries()).map(([modelName, events]) => {
      const pricing = this.pricing.find((p) => p.model === modelName)
        ?? { inputPricePerKToken: 0.003, outputPricePerKToken: 0.015 };

      const totalInput = events.reduce((s, e) => s + e.inputTokens, 0);
      const totalOutput = events.reduce((s, e) => s + e.outputTokens, 0);
      const inputCost = (totalInput / 1000) * pricing.inputPricePerKToken;
      const outputCost = (totalOutput / 1000) * pricing.outputPricePerKToken;

      return {
        model: modelName,
        tenantId,
        totalInputTokens: totalInput,
        totalOutputTokens: totalOutput,
        inputCost,
        outputCost,
        totalCost: inputCost + outputCost,
        period: `${periodStart ?? 'all'} ~ ${periodEnd ?? 'now'}`,
      };
    });
  }

  // -- 품질 집계 -- Design §3 ────────────────────────────────────────────

  /** 품질 메트릭 집계 */
  getQualityMetrics(model?: string): QualityMetrics[] {
    let filtered = this.qualityFeedbacks;
    if (model) filtered = filtered.filter((f) => f.model === model);

    const byModel = new Map<string, QualityFeedback[]>();
    for (const fb of filtered) {
      const group = byModel.get(fb.model) ?? [];
      group.push(fb);
      byModel.set(fb.model, group);
    }

    return Array.from(byModel.entries()).map(([modelName, feedbacks]) => {
      const hallucinations = feedbacks.filter((f) => f.hallucinationDetected).length;
      const satisfactions = feedbacks.filter((f) => f.userSatisfaction !== undefined);

      return {
        model: modelName,
        hallucinationRate: feedbacks.length > 0
          ? (hallucinations / feedbacks.length) * 100
          : 0,
        avgRelevance: feedbacks.length > 0
          ? feedbacks.reduce((s, f) => s + f.relevanceScore, 0) / feedbacks.length
          : 0,
        avgSatisfaction: satisfactions.length > 0
          ? satisfactions.reduce((s, f) => s + (f.userSatisfaction ?? 0), 0) / satisfactions.length
          : 0,
        totalFeedbacks: feedbacks.length,
        period: 'current',
      };
    });
  }

  // -- 윤리 지표 -- Design §4 ────────────────────────────────────────────

  /** AI 윤리 지표 집계 */
  getEthicsMetrics(): EthicsMetrics {
    const events = this.ethicsEvents;
    if (events.length === 0) {
      return {
        avgBiasScore: 0,
        avgExplainability: 0,
        fairnessIndex: 1,
        transparencyRate: 0,
        totalEvents: 0,
        period: 'current',
      };
    }

    const avgBias = events.reduce((s, e) => s + e.biasScore, 0) / events.length;
    const avgExplain = events.reduce((s, e) => s + e.explainabilityScore, 0) / events.length;
    const fairness = 1 - avgBias; // 편향 낮을수록 공정
    const transparent = events.filter((e) => e.explainabilityScore > 0.7).length;

    return {
      avgBiasScore: avgBias,
      avgExplainability: avgExplain,
      fairnessIndex: Math.max(0, fairness),
      transparencyRate: (transparent / events.length) * 100,
      totalEvents: events.length,
      period: 'current',
    };
  }

  // -- 알림 -- Design §6 ────────────────────────────────────────────────

  /** 알림 콜백 등록 */
  onAlert(callback: (alert: GovernanceAlert) => void): void {
    this.alertCallbacks.push(callback);
  }

  /** 알림 규칙 검사 */
  checkAlerts(): GovernanceAlert[] {
    const alerts: GovernanceAlert[] = [];
    const usageMetrics = this.getUsageMetrics();
    const qualityMetrics = this.getQualityMetrics();
    const ethicsMetrics = this.getEthicsMetrics();

    for (const rule of this.alertRules) {
      if (!rule.enabled) continue;

      let value: number | undefined;

      // 메트릭 값 조회
      switch (rule.metric) {
        case 'errorRate':
          value = usageMetrics.reduce((max, m) => Math.max(max, m.errorRate), 0);
          break;
        case 'avgLatencyMs':
          value = usageMetrics.reduce((max, m) => Math.max(max, m.avgLatencyMs), 0);
          break;
        case 'hallucinationRate':
          value = qualityMetrics.reduce((max, m) => Math.max(max, m.hallucinationRate), 0);
          break;
        case 'biasScore':
          value = ethicsMetrics.avgBiasScore;
          break;
      }

      if (value === undefined) continue;

      const triggered =
        (rule.operator === 'gt' && value > rule.threshold) ||
        (rule.operator === 'gte' && value >= rule.threshold) ||
        (rule.operator === 'lt' && value < rule.threshold) ||
        (rule.operator === 'lte' && value <= rule.threshold);

      if (triggered) {
        const alert: GovernanceAlert = {
          ruleId: rule.id,
          metric: rule.metric,
          currentValue: value,
          threshold: rule.threshold,
          severity: rule.severity,
          message: rule.message,
          timestamp: new Date().toISOString(),
        };
        alerts.push(alert);

        for (const cb of this.alertCallbacks) {
          try { cb(alert); } catch { /* 콜백 오류 무시 */ }
        }
      }
    }

    if (alerts.length > 0) {
      auditLog('alerts_triggered', { count: alerts.length });
    }

    return alerts;
  }

  // -- 정리 ──────────────────────────────────────────────────────────────

  /** 오래된 이벤트 정리 (보존 기간 이전) */
  purgeEvents(retentionDays: number): void {
    const cutoff = new Date(Date.now() - retentionDays * 86400_000).toISOString();
    const beforeCount = this.callEvents.length;
    this.callEvents = this.callEvents.filter((e) => e.timestamp >= cutoff);
    this.qualityFeedbacks = this.qualityFeedbacks.filter((e) => e.timestamp >= cutoff);
    this.ethicsEvents = this.ethicsEvents.filter((e) => e.timestamp >= cutoff);

    auditLog('events_purged', {
      retentionDays,
      removed: beforeCount - this.callEvents.length,
    });
  }
}

// -- 팩토리 ──────────────────────────────────────────────────────────────────

let metricsInstance: AIGovernanceMetrics | null = null;

export function getAIGovernanceMetrics(): AIGovernanceMetrics {
  if (!metricsInstance) {
    metricsInstance = new AIGovernanceMetrics();
  }
  return metricsInstance;
}

export function resetAIGovernanceMetrics(): void {
  metricsInstance = null;
}
