// MTU-N265 단위 테스트: BI 자동화 AI 리포트 생성
// Design Ref: MTU-N265 DESIGN §1~§6
// CSAP: D-06 감사/이력, D-07 모니터링, D-12 개발 보안

import { describe, it, expect, beforeEach } from 'vitest';

import {
  ReportTemplateRegistry,
  ReportMetricsCollector,
  InsightGenerator,
  ReportRenderer,
  BiReportEngine,
  createBiReportEngine,
  type KpiCard,
  type GeneratedReport,
} from '../../src/lib/bi-report-engine.js';

// -- 헬퍼 ──────────────────────────────────────────────────────────────────

function makeKpi(overrides: Partial<KpiCard> = {}): KpiCard {
  return {
    name: 'API 응답시간',
    currentValue: 120,
    previousValue: 150,
    unit: 'ms',
    trend: 'down',
    changePercent: -20,
    status: 'good',
    ...overrides,
  };
}

// -- ReportTemplateRegistry -- Design §1 ──────────────────────────────────

describe('ReportTemplateRegistry (FR-N265.1)', () => {
  let registry: ReportTemplateRegistry;

  beforeEach(() => {
    registry = new ReportTemplateRegistry();
  });

  it('템플릿을 등록한다', () => {
    const template = registry.register({
      type: 'operations',
      name: '운영 보고서',
      description: '',
      sections: [],
      frequency: 'weekly',
      recipients: ['admin@test.com'],
      isActive: true,
    });
    expect(template.id).toBeTruthy();
    expect(registry.getAll()).toHaveLength(1);
  });

  it('ID로 조회한다', () => {
    const template = registry.register({
      type: 'security', name: 'test', description: '',
      sections: [], frequency: 'weekly', recipients: [], isActive: true,
    });
    expect(registry.get(template.id)).toBeDefined();
    expect(registry.get('nonexistent')).toBeUndefined();
  });

  it('유형별 검색', () => {
    registry.register({ type: 'operations', name: 'ops', description: '', sections: [], frequency: 'weekly', recipients: [], isActive: true });
    registry.register({ type: 'security', name: 'sec', description: '', sections: [], frequency: 'weekly', recipients: [], isActive: true });
    registry.register({ type: 'operations', name: 'ops2', description: '', sections: [], frequency: 'daily', recipients: [], isActive: true });
    expect(registry.getByType('operations')).toHaveLength(2);
    expect(registry.getByType('security')).toHaveLength(1);
  });

  it('주기별 검색', () => {
    registry.register({ type: 'operations', name: 'w', description: '', sections: [], frequency: 'weekly', recipients: [], isActive: true });
    registry.register({ type: 'operations', name: 'd', description: '', sections: [], frequency: 'daily', recipients: [], isActive: true });
    registry.register({ type: 'operations', name: 'inactive', description: '', sections: [], frequency: 'weekly', recipients: [], isActive: false });
    expect(registry.getByFrequency('weekly')).toHaveLength(1); // 활성만
    expect(registry.getByFrequency('daily')).toHaveLength(1);
  });

  it('활성 템플릿만 조회', () => {
    registry.register({ type: 'operations', name: 'active', description: '', sections: [], frequency: 'weekly', recipients: [], isActive: true });
    registry.register({ type: 'operations', name: 'inactive', description: '', sections: [], frequency: 'weekly', recipients: [], isActive: false });
    expect(registry.getActive()).toHaveLength(1);
  });

  it('템플릿 삭제', () => {
    const t = registry.register({ type: 'operations', name: 'x', description: '', sections: [], frequency: 'weekly', recipients: [], isActive: true });
    expect(registry.remove(t.id)).toBe(true);
    expect(registry.getAll()).toHaveLength(0);
  });
});

// -- ReportMetricsCollector -- Design §2 ──────────────────────────────────

describe('ReportMetricsCollector (FR-N265.2)', () => {
  let collector: ReportMetricsCollector;

  beforeEach(() => {
    collector = new ReportMetricsCollector();
  });

  it('메트릭을 기록한다', () => {
    collector.record('api_latency', 120, '2026-04-01');
    collector.record('api_latency', 130, '2026-04-02');
    const data = collector.getMetric('api_latency', '2026-04-01', '2026-04-02');
    expect(data).toHaveLength(2);
  });

  it('기간으로 필터링한다', () => {
    collector.record('errors', 5, '2026-03-30');
    collector.record('errors', 3, '2026-04-01');
    collector.record('errors', 2, '2026-04-02');
    const data = collector.getMetric('errors', '2026-04-01', '2026-04-02');
    expect(data).toHaveLength(2);
  });

  it('등록된 메트릭 이름을 반환한다', () => {
    collector.record('cpu', 45);
    collector.record('memory', 70);
    expect(collector.getMetricNames()).toContain('cpu');
    expect(collector.getMetricNames()).toContain('memory');
  });

  it('KPI 카드를 생성한다', () => {
    collector.record('latency', 150, '2026-03-01');
    collector.record('latency', 140, '2026-03-02');
    collector.record('latency', 120, '2026-04-01');
    collector.record('latency', 110, '2026-04-02');

    const kpi = collector.buildKpi(
      'API 응답시간',
      'latency',
      'ms',
      { from: '2026-04-01', to: '2026-04-02' },
      { from: '2026-03-01', to: '2026-03-02' },
      'down', // 낮을수록 좋음
    );
    expect(kpi.name).toBe('API 응답시간');
    expect(kpi.currentValue).toBeLessThan(kpi.previousValue);
    expect(kpi.trend).toBe('down');
    expect(kpi.status).toBe('good'); // down이 좋은 방향
  });

  it('데이터 없는 KPI는 0', () => {
    const kpi = collector.buildKpi(
      'test', 'missing', '', { from: '2026-04-01', to: '2026-04-02' },
      { from: '2026-03-01', to: '2026-03-02' }, 'up',
    );
    expect(kpi.currentValue).toBe(0);
    expect(kpi.previousValue).toBe(0);
  });
});

// -- InsightGenerator -- Design §3 ──────────────────────────────────────────

describe('InsightGenerator (FR-N265.3)', () => {
  let generator: InsightGenerator;

  beforeEach(() => {
    generator = new InsightGenerator();
  });

  it('critical KPI에서 anomaly 인사이트를 생성한다', () => {
    const kpis: KpiCard[] = [
      makeKpi({ name: '에러율', status: 'critical', changePercent: 50, trend: 'up' }),
    ];
    const insights = generator.generateFromKpis(kpis);
    expect(insights.some((i) => i.category === 'anomaly' && i.severity === 'high')).toBe(true);
    expect(insights.some((i) => i.title.includes('에러율'))).toBe(true);
  });

  it('warning KPI에서 trend 인사이트를 생성한다', () => {
    const kpis: KpiCard[] = [
      makeKpi({ name: '응답시간', status: 'warning', changePercent: -15, trend: 'down' }),
    ];
    const insights = generator.generateFromKpis(kpis);
    expect(insights.some((i) => i.category === 'trend' && i.severity === 'medium')).toBe(true);
  });

  it('긍정적 KPI에서 양호 인사이트를 생성한다', () => {
    const kpis: KpiCard[] = [
      makeKpi({ name: 'SLA', status: 'good', changePercent: 15, trend: 'up' }),
      makeKpi({ name: '처리량', status: 'good', changePercent: 20, trend: 'up' }),
    ];
    const insights = generator.generateFromKpis(kpis);
    expect(insights.some((i) => i.title === '양호한 지표 다수')).toBe(true);
  });

  it('모든 KPI가 stable이면 인사이트 최소', () => {
    const kpis: KpiCard[] = [
      makeKpi({ status: 'good', changePercent: 0, trend: 'stable' }),
    ];
    const insights = generator.generateFromKpis(kpis);
    // stable + good + 변화 0% → 양호 인사이트도 10% 미만으로 제외
    expect(insights.length).toBeLessThanOrEqual(1);
  });
});

// -- ReportRenderer -- Design §4 ──────────────────────────────────────────

describe('ReportRenderer (FR-N265.4)', () => {
  it('마크다운 보고서를 렌더링한다', () => {
    const renderer = new ReportRenderer();
    const md = renderer.render({
      id: 'r1',
      templateId: 't1',
      type: 'operations',
      title: '운영 현황 보고서',
      period: { from: '2026-04-01', to: '2026-04-07' },
      kpis: [makeKpi()],
      insights: [{
        id: 'i1', title: '이상 감지', description: '설명', category: 'anomaly',
        severity: 'high', relatedMetrics: [], suggestedAction: '조치',
      }],
      tables: [{
        title: '서비스 상태',
        headers: ['서비스', '상태'],
        rows: [['API', '정상'], ['DB', '주의']],
      }],
      status: 'generated',
      generatedAt: '2026-04-07T00:00:00Z',
      version: 1,
    });

    expect(md).toContain('# 운영 현황 보고서');
    expect(md).toContain('핵심 성과 지표');
    expect(md).toContain('AI 분석 인사이트');
    expect(md).toContain('[높음]');
    expect(md).toContain('서비스 상태');
  });
});

// -- BiReportEngine (통합) ──────────────────────────────────────────────────

describe('BiReportEngine (FR-N265.5~6)', () => {
  let engine: BiReportEngine;
  let templateId: string;

  beforeEach(() => {
    engine = createBiReportEngine();
    const templates = engine.getTemplateRegistry().getAll();
    templateId = templates[0]!.id;
  });

  it('보고서를 생성한다', () => {
    const report = engine.generate(
      templateId,
      { from: '2026-04-01', to: '2026-04-07' },
      [makeKpi()],
    );
    expect(report.id).toBeTruthy();
    expect(report.markdownContent).toContain('API 응답시간');
    expect(report.status).toBe('generated');
    expect(report.version).toBe(1);
  });

  it('존재하지 않는 템플릿이면 에러', () => {
    expect(() =>
      engine.generate('nonexistent', { from: '', to: '' }, []),
    ).toThrow('템플릿을 찾을 수 없습니다');
  });

  it('보고서 이력을 조회한다', () => {
    engine.generate(templateId, { from: '2026-04-01', to: '2026-04-07' }, [makeKpi()]);
    engine.generate(templateId, { from: '2026-04-08', to: '2026-04-14' }, [makeKpi()]);
    const history = engine.getHistory(templateId);
    expect(history).toHaveLength(2);
    expect(history[1]!.version).toBe(2);
  });

  it('두 보고서를 비교한다', () => {
    const r1 = engine.generate(templateId, { from: '2026-04-01', to: '2026-04-07' },
      [makeKpi({ name: 'latency', currentValue: 150 })]);
    const r2 = engine.generate(templateId, { from: '2026-04-08', to: '2026-04-14' },
      [makeKpi({ name: 'latency', currentValue: 120 })]);

    const comparison = engine.compare(r1.id, r2.id);
    expect(comparison.kpiChanges).toHaveLength(1);
    expect(comparison.kpiChanges[0]!.change).toBe(-30);
  });

  it('비교 시 보고서 없으면 에러', () => {
    expect(() => engine.compare('a', 'b')).toThrow('보고서를 찾을 수 없습니다');
  });

  it('BI 메트릭을 반환한다', () => {
    engine.generate(templateId, { from: '2026-04-01', to: '2026-04-07' }, [makeKpi()]);
    const metrics = engine.getBiMetrics();
    expect(metrics.totalReports).toBe(1);
    expect(metrics.activeTemplates).toBe(3); // createBiReportEngine 기본 3개
    expect(metrics.lastGeneratedAt).toBeTruthy();
  });
});

// -- createBiReportEngine 팩토리 ──────────────────────────────────────────

describe('createBiReportEngine 팩토리', () => {
  it('기본 템플릿 3개가 등록된다', () => {
    const engine = createBiReportEngine();
    expect(engine.getTemplateRegistry().getAll()).toHaveLength(3);
    expect(engine.getTemplateRegistry().getByType('operations')).toHaveLength(1);
    expect(engine.getTemplateRegistry().getByType('security')).toHaveLength(1);
    expect(engine.getTemplateRegistry().getByType('business')).toHaveLength(1);
  });
});
