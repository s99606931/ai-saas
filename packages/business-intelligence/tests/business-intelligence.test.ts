/**
 * BI/Analytics 테스트 (KPI/시계열/Text2SQL/통계)
 * Plan SC: FR-BI.*, FR-PA.*, FR-T2A.*, FR-STAT.*
 */

import {
  KpiRegistry,
  TimeSeriesAnalyzer,
  TextToSqlConverter,
  PublicStatisticsBuilder,
} from '../src/index';

describe('KpiRegistry', () => {
  let r: KpiRegistry;
  beforeEach(() => {
    r = new KpiRegistry();
  });

  it('register + record + latest', () => {
    r.register({ kpiId: 'k1', name: '민원처리율', unit: '%', target: 95 });
    r.record({ kpiId: 'k1', value: 90, timestamp: '2026-04-12' });
    expect(r.latest('k1')?.value).toBe(90);
  });

  it('record: 미정의 KPI 시 오류', () => {
    expect(() => r.record({ kpiId: 'unknown', value: 1, timestamp: '' })).toThrow(
      /미정의 KPI/,
    );
  });

  it('evaluateAlert: critical 임계 넘으면 critical', () => {
    r.register({
      kpiId: 'k1',
      name: 'errors',
      unit: 'count',
      warningThreshold: 10,
      criticalThreshold: 50,
    });
    expect(r.evaluateAlert({ kpiId: 'k1', value: 100, timestamp: '' })).toBe('critical');
    expect(r.evaluateAlert({ kpiId: 'k1', value: 20, timestamp: '' })).toBe('warning');
    expect(r.evaluateAlert({ kpiId: 'k1', value: 5, timestamp: '' })).toBe('ok');
  });

  it('evaluateAlert: 미존재 KPI는 ok', () => {
    expect(r.evaluateAlert({ kpiId: 'x', value: 0, timestamp: '' })).toBe('ok');
  });

  it('list: 정의된 KPI 목록', () => {
    r.register({ kpiId: 'k1', name: 'k1', unit: '' });
    r.register({ kpiId: 'k2', name: 'k2', unit: '' });
    expect(r.list().length).toBe(2);
  });
});

describe('TimeSeriesAnalyzer', () => {
  const t = new TimeSeriesAnalyzer();

  it('decompose: 길이 일치', () => {
    const series = Array.from({ length: 14 }, (_, i) => ({
      timestamp: `2026-04-${i + 1}`,
      value: i * 10,
    }));
    const r = t.decompose(series);
    expect(r.trend.length).toBe(14);
    expect(r.seasonal.length).toBe(14);
    expect(r.residual.length).toBe(14);
  });

  it('forecast: 상승 시리즈 → 다음 값 증가', () => {
    const series = Array.from({ length: 5 }, (_, i) => ({
      timestamp: `t${i}`,
      value: i * 10,
    }));
    const f = t.forecast(series, 3);
    expect(f.length).toBe(3);
    expect(f[0]).toBeGreaterThan(40);
  });

  it('forecast: 길이 1 이하 → 빈 배열', () => {
    expect(t.forecast([{ timestamp: '', value: 1 }], 3)).toEqual([]);
  });

  it('mape: 일치하면 0', () => {
    expect(t.mape([100, 200], [100, 200])).toBe(0);
  });

  it('mape: 빈 입력 0', () => {
    expect(t.mape([], [])).toBe(0);
  });

  it('mape: 정상 계산', () => {
    expect(t.mape([100], [110])).toBeCloseTo(10);
  });
});

describe('TextToSqlConverter', () => {
  let c: TextToSqlConverter;
  beforeEach(() => {
    c = new TextToSqlConverter();
    c.registerSchema('users', ['id', 'name', 'email', 'age'], ['email']);
  });

  it('count 쿼리', () => {
    const r = c.convert({ text: 'users 개수', tableHint: 'users' });
    expect(r.sql).toContain('COUNT(*)');
    expect(r.piiMasked).toContain('email');
  });

  it('sum 쿼리', () => {
    const r = c.convert({ text: '합계 users', tableHint: 'users' });
    expect(r.sql).toContain('SUM');
  });

  it('avg 쿼리', () => {
    const r = c.convert({ text: '평균', tableHint: 'users' });
    expect(r.sql).toContain('AVG');
  });

  it('PII 컬럼 SELECT에서 제외', () => {
    const r = c.convert({ text: 'users 보여줘', tableHint: 'users' });
    expect(r.sql).not.toContain('email');
    expect(r.piiMasked).toContain('email');
  });

  it('미등록 테이블 시 오류', () => {
    expect(() => c.convert({ text: 'unknown', tableHint: 'unknown' })).toThrow(
      /테이블 추론/,
    );
  });
});

describe('PublicStatisticsBuilder', () => {
  let b: PublicStatisticsBuilder;
  beforeEach(() => {
    b = new PublicStatisticsBuilder();
  });

  it('detectOutliers: IQR 기반', () => {
    [10, 11, 12, 13, 14, 15, 16, 17, 18, 100].forEach((v, i) =>
      b.add({ code: 'X', name: '인구', value: v, unit: '명', period: `2026-${i}` }),
    );
    const outliers = b.detectOutliers('X');
    expect(outliers.find((o) => o.value === 100)).toBeDefined();
  });

  it('detectOutliers: 표본 부족 시 빈', () => {
    b.add({ code: 'X', name: '', value: 1, unit: '', period: '2026' });
    expect(b.detectOutliers('X')).toEqual([]);
  });

  it('toKosisFormat: 키 변환', () => {
    b.add({ code: 'X', name: '인구', value: 1234, unit: '명', period: '2026-04' });
    const k = b.toKosisFormat();
    expect(k[0]?.PRD_DE).toBe('202604');
    expect(k[0]?.TBL_NM).toBe('인구');
    expect(k[0]?.UNIT_NM).toBe('명');
  });
});
