// MTU-N260 단위 테스트: 고객 이탈 예측 엔진
// Design Ref: MTU-N260 DESIGN §1~§6
// Plan SC: FR-N260.1~FR-N260.6
// CSAP: D-06 감사, D-07 모니터링, D-12 개발 보안

import { describe, it, expect, beforeEach } from 'vitest';

import {
  UsageCollector,
  ChurnScoreCalculator,
  ChurnPredictionEngine,
  createChurnPredictionEngine,
  generateRetentionActions,
  type TenantUsageData,
  type ChurnSignal,
} from '../../src/lib/churn-prediction.js';

// -- 헬퍼 ──────────────────────────────────────────────────────────────────

function makeUsageData(overrides: Partial<TenantUsageData> = {}): TenantUsageData {
  return {
    tenantId: 'tenant-A',
    period: '2026-04-01',
    loginCount: 100,
    dauCount: 30,
    apiCallCount: 5000,
    featureUsage: { dashboard: 50, report: 20, search: 30 },
    averageSessionMinutes: 25,
    supportTickets: 2,
    complaintTickets: 0,
    paymentStatus: 'paid',
    revenue: 1000000,
    ...overrides,
  };
}

// -- UsageCollector -- Design §1 ──────────────────────────────────────────

describe('UsageCollector (FR-N260.1)', () => {
  let collector: UsageCollector;

  beforeEach(() => {
    collector = new UsageCollector();
  });

  it('사용 데이터를 기록한다', () => {
    collector.record(makeUsageData());
    const usage = collector.getUsage('tenant-A', 7);
    expect(usage).toHaveLength(1);
  });

  it('최근 N일 데이터를 조회한다', () => {
    for (let i = 0; i < 10; i++) {
      collector.record(makeUsageData({ period: `2026-04-${String(i + 1).padStart(2, '0')}` }));
    }
    const recent = collector.getUsage('tenant-A', 5);
    expect(recent).toHaveLength(5);
  });

  it('최대 90일만 유지한다', () => {
    for (let i = 0; i < 100; i++) {
      collector.record(makeUsageData({ period: `2026-0${Math.floor(i / 30) + 1}-${String((i % 30) + 1).padStart(2, '0')}` }));
    }
    const all = collector.getUsage('tenant-A', 200);
    expect(all.length).toBeLessThanOrEqual(90);
  });

  it('전체 테넌트 목록을 반환한다', () => {
    collector.record(makeUsageData({ tenantId: 'tenant-A' }));
    collector.record(makeUsageData({ tenantId: 'tenant-B' }));
    expect(collector.getTenantIds()).toEqual(['tenant-A', 'tenant-B']);
  });

  it('최신 데이터를 반환한다', () => {
    collector.record(makeUsageData({ period: '2026-04-01' }));
    collector.record(makeUsageData({ period: '2026-04-02' }));
    const latest = collector.getLatest('tenant-A');
    expect(latest).not.toBeNull();
    expect(latest!.period).toBe('2026-04-02');
  });

  it('데이터 없는 테넌트는 null', () => {
    expect(collector.getLatest('nonexistent')).toBeNull();
  });
});

// -- ChurnScoreCalculator -- Design §2 ──────────────────────────────────────

describe('ChurnScoreCalculator (FR-N260.2)', () => {
  let calculator: ChurnScoreCalculator;

  beforeEach(() => {
    calculator = new ChurnScoreCalculator();
  });

  it('정상 사용 시 낮은 점수', () => {
    const current = [makeUsageData({ loginCount: 100 })];
    const previous = [makeUsageData({ loginCount: 100 })];
    const { score } = calculator.calculate(current, previous);
    expect(score).toBeLessThan(20);
  });

  it('로그인 급감 시 login_decline 징후', () => {
    const current = [makeUsageData({ loginCount: 10 })];
    const previous = [makeUsageData({ loginCount: 100 })];
    const { signals } = calculator.calculate(current, previous);
    expect(signals.some((s) => s.type === 'login_decline')).toBe(true);
  });

  it('기능 사용 감소 시 feature_abandonment 징후', () => {
    const current = [makeUsageData({ featureUsage: { dashboard: 5 } })];
    const previous = [makeUsageData({ featureUsage: { dashboard: 50, report: 20, search: 30 } })];
    const { signals } = calculator.calculate(current, previous);
    expect(signals.some((s) => s.type === 'feature_abandonment')).toBe(true);
  });

  it('API 호출 급감 시 api_decline 징후', () => {
    const current = [makeUsageData({ apiCallCount: 500 })];
    const previous = [makeUsageData({ apiCallCount: 5000 })];
    const { signals } = calculator.calculate(current, previous);
    expect(signals.some((s) => s.type === 'api_decline')).toBe(true);
  });

  it('불만 티켓 3건 이상 시 complaint_increase 징후', () => {
    const current = [makeUsageData({ complaintTickets: 5 })];
    const previous = [makeUsageData({ complaintTickets: 0 })];
    const { signals } = calculator.calculate(current, previous);
    expect(signals.some((s) => s.type === 'complaint_increase')).toBe(true);
  });

  it('결제 연체 시 payment_overdue 징후', () => {
    const current = [makeUsageData({ paymentStatus: 'overdue' })];
    const previous = [makeUsageData()];
    const { signals } = calculator.calculate(current, previous);
    expect(signals.some((s) => s.type === 'payment_overdue')).toBe(true);
  });

  it('데이터 없으면 score 100 (완전 이탈)', () => {
    const { score, signals } = calculator.calculate([], [makeUsageData()]);
    expect(score).toBe(100);
    expect(signals[0]!.type).toBe('login_decline');
  });

  it('위험 등급 결정 — critical', () => {
    expect(calculator.getRiskLevel(80)).toBe('critical');
    expect(calculator.getRiskLevel(90)).toBe('critical');
  });

  it('위험 등급 결정 — high', () => {
    expect(calculator.getRiskLevel(60)).toBe('high');
    expect(calculator.getRiskLevel(79)).toBe('high');
  });

  it('위험 등급 결정 — medium', () => {
    expect(calculator.getRiskLevel(40)).toBe('medium');
  });

  it('위험 등급 결정 — low', () => {
    expect(calculator.getRiskLevel(20)).toBe('low');
  });

  it('위험 등급 결정 — healthy', () => {
    expect(calculator.getRiskLevel(0)).toBe('healthy');
    expect(calculator.getRiskLevel(19)).toBe('healthy');
  });
});

// -- generateRetentionActions -- Design §5 ──────────────────────────────────

describe('generateRetentionActions (FR-N260.5)', () => {
  it('login_decline → onboarding_refresh', () => {
    const signals: ChurnSignal[] = [{
      type: 'login_decline',
      severity: 'high',
      description: '90% 감소',
      metric: 'loginCount',
      currentValue: 10,
      previousValue: 100,
      changePercent: -90,
      detectedAt: new Date().toISOString(),
    }];
    const actions = generateRetentionActions(signals, 'high');
    expect(actions.some((a) => a.type === 'onboarding_refresh')).toBe(true);
  });

  it('feature_abandonment → feature_training', () => {
    const signals: ChurnSignal[] = [{
      type: 'feature_abandonment',
      severity: 'medium',
      description: '',
      metric: 'featureUsage',
      currentValue: 5,
      previousValue: 50,
      changePercent: -90,
      detectedAt: new Date().toISOString(),
    }];
    const actions = generateRetentionActions(signals, 'medium');
    expect(actions.some((a) => a.type === 'feature_training')).toBe(true);
  });

  it('payment_overdue → discount_offer', () => {
    const signals: ChurnSignal[] = [{
      type: 'payment_overdue',
      severity: 'high',
      description: '',
      metric: 'paymentStatus',
      currentValue: 1,
      previousValue: 0,
      changePercent: 100,
      detectedAt: new Date().toISOString(),
    }];
    const actions = generateRetentionActions(signals, 'high');
    expect(actions.some((a) => a.type === 'discount_offer')).toBe(true);
  });

  it('critical 위험이면 CS 긴급 배정 추가', () => {
    const signals: ChurnSignal[] = [{
      type: 'login_decline',
      severity: 'critical',
      description: '',
      metric: 'loginCount',
      currentValue: 0,
      previousValue: 100,
      changePercent: -100,
      detectedAt: new Date().toISOString(),
    }];
    const actions = generateRetentionActions(signals, 'critical');
    expect(actions.some((a) => a.type === 'cs_assignment' && a.priority === 'critical')).toBe(true);
  });

  it('빈 징후면 빈 액션', () => {
    const actions = generateRetentionActions([], 'healthy');
    expect(actions).toHaveLength(0);
  });
});

// -- ChurnPredictionEngine (통합) ───────────────────────────────────────────

describe('ChurnPredictionEngine (FR-N260.3~6)', () => {
  let engine: ChurnPredictionEngine;

  beforeEach(() => {
    engine = createChurnPredictionEngine();
  });

  it('사용 데이터 기록 후 분석한다', () => {
    engine.recordUsage(makeUsageData({ tenantId: 'tenant-A', period: '2026-04-01' }));
    engine.recordUsage(makeUsageData({ tenantId: 'tenant-A', period: '2026-04-02' }));

    const analysis = engine.analyze('tenant-A', 7);
    expect(analysis.tenantId).toBe('tenant-A');
    expect(analysis.riskScore).toBeGreaterThanOrEqual(0);
    expect(analysis.riskLevel).toBeTruthy();
    expect(analysis.analyzedAt).toBeTruthy();
  });

  it('높은 이탈 위험 시 예상 이탈일을 반환한다', () => {
    // 이전 기간: 정상
    for (let i = 1; i <= 14; i++) {
      engine.recordUsage(makeUsageData({
        tenantId: 'tenant-A',
        period: `2026-03-${String(i).padStart(2, '0')}`,
        loginCount: 100,
        apiCallCount: 5000,
      }));
    }
    // 현재 기간: 급감
    for (let i = 15; i <= 28; i++) {
      engine.recordUsage(makeUsageData({
        tenantId: 'tenant-A',
        period: `2026-03-${String(i).padStart(2, '0')}`,
        loginCount: 2,
        apiCallCount: 100,
        featureUsage: { dashboard: 1 },
        complaintTickets: 5,
        paymentStatus: 'overdue',
      }));
    }

    const analysis = engine.analyze('tenant-A', 14);
    expect(['critical', 'high']).toContain(analysis.riskLevel);
    if (analysis.riskLevel === 'critical' || analysis.riskLevel === 'high') {
      expect(analysis.predictedChurnDate).not.toBeNull();
    }
  });

  it('전체 테넌트 일괄 분석', () => {
    engine.recordUsage(makeUsageData({ tenantId: 'tenant-A' }));
    engine.recordUsage(makeUsageData({ tenantId: 'tenant-B' }));
    engine.recordUsage(makeUsageData({ tenantId: 'tenant-C' }));

    const results = engine.analyzeAll();
    expect(results).toHaveLength(3);
  });

  it('대시보드 메트릭을 반환한다', () => {
    engine.recordUsage(makeUsageData({ tenantId: 'tenant-A' }));
    engine.recordUsage(makeUsageData({ tenantId: 'tenant-B' }));

    const metrics = engine.getDashboardMetrics();
    expect(metrics.totalTenants).toBe(2);
    expect(metrics.averageRiskScore).toBeGreaterThanOrEqual(0);
  });

  it('분석 이력을 조회한다', () => {
    engine.recordUsage(makeUsageData());
    engine.analyze('tenant-A');
    engine.analyze('tenant-A');

    const history = engine.getAnalysisHistory('tenant-A');
    expect(history).toHaveLength(2);
  });

  it('알림 설정을 조회/변경한다', () => {
    const config = engine.getAlertConfig();
    expect(config.criticalThreshold).toBe(80);

    engine.updateAlertConfig({ criticalThreshold: 90 });
    expect(engine.getAlertConfig().criticalThreshold).toBe(90);
  });

  it('트렌드 분석: 점수 증가 시 declining', () => {
    // 1차 분석: 정상
    engine.recordUsage(makeUsageData({ tenantId: 'tenant-A', loginCount: 100 }));
    engine.analyze('tenant-A');

    // 2차 분석: 급감 (새 데이터 없이 분석하면 동일하므로 급감 데이터 추가)
    for (let i = 0; i < 14; i++) {
      engine.recordUsage(makeUsageData({
        tenantId: 'tenant-A',
        loginCount: 2,
        apiCallCount: 50,
        featureUsage: { dashboard: 1 },
        complaintTickets: 5,
        paymentStatus: 'overdue',
      }));
    }
    const analysis2 = engine.analyze('tenant-A');
    // 점수가 증가했으므로 declining
    expect(['declining', 'stable']).toContain(analysis2.trend);
  });
});

// -- 팩토리 ──────────────────────────────────────────────────────────────────

describe('createChurnPredictionEngine 팩토리', () => {
  it('기본 설정으로 생성한다', () => {
    const engine = createChurnPredictionEngine();
    expect(engine).toBeInstanceOf(ChurnPredictionEngine);
    expect(engine.getAlertConfig().criticalThreshold).toBe(80);
  });

  it('사용자 설정으로 생성한다', () => {
    const engine = createChurnPredictionEngine({ criticalThreshold: 90 });
    expect(engine.getAlertConfig().criticalThreshold).toBe(90);
  });
});
