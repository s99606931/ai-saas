// NL->Visualization 단위 테스트 -- MTU-N266
import { describe, it, expect } from 'vitest';
import {
  parseNLQuery,
  recommendChartType,
  generateVegaLiteSpec,
  createDashboard,
  nlToVisualization,
  getVisualizationAuditLog,
  type DataSourceMeta,
  type NLParseResult,
} from '../../src/lib/nl-visualization';

const MOCK_DATA_SOURCES: DataSourceMeta[] = [
  {
    id: 'ds-1',
    name: '민원현황',
    description: '공공기관 민원 데이터',
    fields: [
      { name: '처리건수', type: 'quantitative', description: '처리건수', aliases: ['건수', '접수건'] },
      { name: '부서', type: 'nominal', description: '부서', aliases: ['담당부서'] },
      { name: '접수일', type: 'temporal', description: '접수일', aliases: ['날짜', '일자'] },
      { name: '유형', type: 'nominal', description: '민원 유형', aliases: ['분류', '카테고리'] },
    ],
  },
];

describe('NL->Visualization', () => {
  describe('parseNLQuery', () => {
    it('추세 의도를 올바르게 감지해야 한다', () => {
      const result = parseNLQuery('월별 민원 접수건 추이', MOCK_DATA_SOURCES);
      expect(result.intent).toBe('trend');
    });

    it('비교 의도를 올바르게 감지해야 한다', () => {
      const result = parseNLQuery('부서별 처리건수 비교', MOCK_DATA_SOURCES);
      expect(result.intent).toBe('comparison');
    });

    it('구성 의도를 올바르게 감지해야 한다', () => {
      const result = parseNLQuery('민원 유형별 비율 구성', MOCK_DATA_SOURCES);
      expect(result.intent).toBe('composition');
    });

    it('엔티티를 올바르게 추출해야 한다', () => {
      const result = parseNLQuery('부서별 처리건수 비교', MOCK_DATA_SOURCES);
      expect(result.entities.length).toBeGreaterThan(0);
      expect(result.entities.some((e) => e.mappedField === '처리건수')).toBe(true);
    });

    it('시간 범위를 추출해야 한다', () => {
      const result = parseNLQuery('최근 3개월 접수건 추이', MOCK_DATA_SOURCES);
      expect(result.timeRange).toBeDefined();
    });

    it('집계 함수를 추출해야 한다', () => {
      const result = parseNLQuery('부서별 평균 처리건수', MOCK_DATA_SOURCES);
      expect(result.aggregation).toBe('avg');
    });

    it('신뢰도가 0~1 범위여야 한다', () => {
      const result = parseNLQuery('부서별 처리건수 비교', MOCK_DATA_SOURCES);
      expect(result.confidence).toBeGreaterThanOrEqual(0);
      expect(result.confidence).toBeLessThanOrEqual(1);
    });
  });

  describe('recommendChartType', () => {
    it('추세 의도에 line 차트를 추천해야 한다', () => {
      const parseResult: NLParseResult = {
        intent: 'trend',
        entities: [
          { text: '건수', type: 'metric', mappedField: 'count' },
          { text: '월', type: 'dimension', mappedField: 'month' },
        ],
        aggregation: 'sum',
        confidence: 0.8,
      };
      const rec = recommendChartType(parseResult);
      expect(rec.primary).toBe('line');
    });

    it('구성 의도에 pie 차트를 추천해야 한다', () => {
      const parseResult: NLParseResult = {
        intent: 'composition',
        entities: [
          { text: '건수', type: 'metric', mappedField: 'count' },
          { text: '유형', type: 'dimension', mappedField: 'type' },
        ],
        aggregation: 'sum',
        confidence: 0.8,
      };
      const rec = recommendChartType(parseResult);
      expect(rec.primary).toBe('pie');
    });

    it('단일 메트릭이면 gauge를 추천해야 한다', () => {
      const parseResult: NLParseResult = {
        intent: 'comparison',
        entities: [{ text: '건수', type: 'metric', mappedField: 'count' }],
        aggregation: 'sum',
        confidence: 0.5,
      };
      const rec = recommendChartType(parseResult);
      expect(rec.primary).toBe('gauge');
    });
  });

  describe('generateVegaLiteSpec', () => {
    it('유효한 Vega-Lite 스펙을 생성해야 한다', () => {
      const parseResult: NLParseResult = {
        intent: 'comparison',
        entities: [
          { text: '건수', type: 'metric', mappedField: 'value' },
          { text: '부서', type: 'dimension', mappedField: 'department' },
        ],
        groupBy: 'department',
        aggregation: 'sum',
        confidence: 0.8,
      };
      const data = [{ department: 'A', value: 100 }, { department: 'B', value: 200 }];
      const spec = generateVegaLiteSpec(parseResult, 'bar', data, '부서별 건수');

      expect(spec.$schema).toContain('vega-lite');
      expect(spec.mark.type).toBe('bar');
      expect(spec.data.values).toEqual(data);
      expect(spec.title).toBe('부서별 건수');
    });
  });

  describe('createDashboard', () => {
    it('대시보드를 올바르게 생성해야 한다', () => {
      const spec = generateVegaLiteSpec(
        { intent: 'comparison', entities: [], aggregation: 'sum', confidence: 0.5 },
        'bar',
        [{ x: 1, y: 2 }],
        '테스트 차트'
      );
      const dashboard = createDashboard('테스트 대시보드', [spec, spec], 2, 'test-user');

      expect(dashboard.title).toBe('테스트 대시보드');
      expect(dashboard.charts).toHaveLength(2);
      expect(dashboard.columns).toBe(2);
    });
  });

  describe('nlToVisualization', () => {
    it('전체 파이프라인이 정상 동작해야 한다', () => {
      const result = nlToVisualization({
        query: '부서별 처리건수 비교',
        dataSources: MOCK_DATA_SOURCES,
        data: [{ department: 'A', value: 100 }],
        actor: 'test-user',
      });

      expect(result.parseResult).toBeDefined();
      expect(result.chartRecommendation).toBeDefined();
      expect(result.spec).toBeDefined();
    });

    it('감사 로그가 기록되어야 한다', () => {
      const before = getVisualizationAuditLog().length;
      nlToVisualization({
        query: '월별 추이',
        dataSources: MOCK_DATA_SOURCES,
        data: [],
        actor: 'auditor',
      });
      expect(getVisualizationAuditLog().length).toBeGreaterThan(before);
    });
  });
});
