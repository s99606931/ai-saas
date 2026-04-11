// NL->Visualization: 자연어 대시보드 생성 -- FR-N266.1~FR-N266.6
// Design Ref: MTU-N266 DESIGN §1~§6
// CSAP: D-06 감사, D-08 접근 통제, D-12 개발 보안
// N2SF: 집계 데이터만 시각화 (O등급)

import { randomUUID } from 'crypto';

// -- 타입 정의 ────────────────────────────────────────────────────────────────

/** 시각화 의도 유형 -- Design §1 */
export type VisualizationIntent =
  | 'trend'
  | 'comparison'
  | 'distribution'
  | 'composition'
  | 'relationship'
  | 'geospatial';

/** 차트 타입 -- Design §3 */
export type ChartType =
  | 'bar'
  | 'line'
  | 'area'
  | 'pie'
  | 'donut'
  | 'scatter'
  | 'heatmap'
  | 'treemap'
  | 'table'
  | 'gauge'
  | 'funnel';

/** 데이터 필드 타입 -- Design §2 */
export type FieldType = 'quantitative' | 'temporal' | 'nominal' | 'ordinal';

/** 데이터 소스 메타데이터 -- Design §2 */
export interface DataSourceMeta {
  id: string;
  name: string;
  fields: DataFieldMeta[];
  description: string;
}

/** 데이터 필드 메타데이터 */
export interface DataFieldMeta {
  name: string;
  type: FieldType;
  description: string;
  aliases: string[];
}

/** NL 파싱 결과 -- Design §1 */
export interface NLParseResult {
  intent: VisualizationIntent;
  entities: ExtractedEntity[];
  timeRange?: { start: string; end: string };
  aggregation?: 'sum' | 'avg' | 'count' | 'max' | 'min';
  groupBy?: string;
  confidence: number;
}

/** 추출된 엔티티 */
export interface ExtractedEntity {
  text: string;
  type: 'metric' | 'dimension' | 'filter' | 'timeRange';
  mappedField?: string;
  mappedSource?: string;
}

/** Vega-Lite 시각화 스펙 -- Design §4 */
export interface VegaLiteSpec {
  $schema: string;
  title: string;
  width: number;
  height: number;
  mark: { type: string; tooltip: boolean };
  encoding: Record<string, unknown>;
  data: { values: unknown[] };
}

/** 대시보드 레이아웃 -- Design §5 */
export interface DashboardLayout {
  id: string;
  title: string;
  charts: DashboardChart[];
  columns: number;
  createdAt: string;
}

/** 대시보드 차트 */
export interface DashboardChart {
  id: string;
  spec: VegaLiteSpec;
  gridPosition: { row: number; col: number; width: number; height: number };
}

/** 감사 항목 -- Design §6 */
export interface VisualizationAuditEntry {
  id: string;
  action: string;
  query: string;
  chartType?: ChartType;
  actor: string;
  timestamp: string;
}

// -- 감사 로그 ────────────────────────────────────────────────────────────────

const auditLog: VisualizationAuditEntry[] = [];

function recordAudit(action: string, query: string, actor: string, chartType?: ChartType): void {
  auditLog.push({
    id: randomUUID(),
    action,
    query,
    chartType,
    actor,
    timestamp: new Date().toISOString(),
  });
}

export function getVisualizationAuditLog(): VisualizationAuditEntry[] {
  return [...auditLog];
}

// -- §1 자연어 파싱 ──────────────────────────────────────────────────────────

/** 의도 키워드 매핑 */
const INTENT_KEYWORDS: Record<VisualizationIntent, string[]> = {
  trend: ['추이', '추세', '변화', '시계열', '월별', '일별', '연도별', '증가', '감소'],
  comparison: ['비교', '대비', '차이', '순위', '랭킹', '상위', '하위'],
  distribution: ['분포', '히스토그램', '밀도', '범위', '분산'],
  composition: ['구성', '비율', '비중', '점유율', '퍼센트'],
  relationship: ['상관', '관계', '연관', '영향', '산점도'],
  geospatial: ['지역별', '시도별', '지도', '위치별'],
};

/** 자연어 질의 파싱 -- FR-N266.1 */
export function parseNLQuery(
  query: string,
  dataSources: DataSourceMeta[]
): NLParseResult {
  const normalizedQuery = query.toLowerCase().trim();

  // 의도 추출
  const intent = detectIntent(normalizedQuery);

  // 엔티티 추출
  const entities = extractEntities(normalizedQuery, dataSources);

  // 시간 범위 추출
  const timeRange = extractTimeRange(normalizedQuery);

  // 집계 함수 추출
  const aggregation = extractAggregation(normalizedQuery);

  // 그룹 기준 추출
  const groupBy = extractGroupBy(normalizedQuery, dataSources);

  // 신뢰도 계산
  const confidence = calculateConfidence(intent, entities);

  return { intent, entities, timeRange, aggregation, groupBy, confidence };
}

/** 의도 감지 */
function detectIntent(query: string): VisualizationIntent {
  let bestIntent: VisualizationIntent = 'comparison';
  let maxScore = 0;

  for (const [intent, keywords] of Object.entries(INTENT_KEYWORDS)) {
    const score = keywords.filter((kw) => query.includes(kw)).length;
    if (score > maxScore) {
      maxScore = score;
      bestIntent = intent as VisualizationIntent;
    }
  }

  return bestIntent;
}

/** 엔티티 추출 */
function extractEntities(query: string, dataSources: DataSourceMeta[]): ExtractedEntity[] {
  const entities: ExtractedEntity[] = [];

  for (const source of dataSources) {
    for (const field of source.fields) {
      const allNames = [field.name, field.description, ...field.aliases];
      for (const name of allNames) {
        if (query.includes(name.toLowerCase())) {
          entities.push({
            text: name,
            type: field.type === 'quantitative' ? 'metric' : 'dimension',
            mappedField: field.name,
            mappedSource: source.id,
          });
          break;
        }
      }
    }
  }

  return entities;
}

/** 시간 범위 추출 */
function extractTimeRange(query: string): { start: string; end: string } | undefined {
  const now = new Date();
  if (query.includes('최근 1개월') || query.includes('지난달')) {
    const start = new Date(now);
    start.setMonth(start.getMonth() - 1);
    return { start: start.toISOString(), end: now.toISOString() };
  }
  if (query.includes('최근 3개월') || query.includes('분기')) {
    const start = new Date(now);
    start.setMonth(start.getMonth() - 3);
    return { start: start.toISOString(), end: now.toISOString() };
  }
  if (query.includes('올해') || query.includes('금년')) {
    const start = new Date(now.getFullYear(), 0, 1);
    return { start: start.toISOString(), end: now.toISOString() };
  }
  return undefined;
}

/** 집계 함수 추출 */
function extractAggregation(query: string): NLParseResult['aggregation'] {
  if (query.includes('합계') || query.includes('총')) return 'sum';
  if (query.includes('평균')) return 'avg';
  if (query.includes('건수') || query.includes('수')) return 'count';
  if (query.includes('최대') || query.includes('최고')) return 'max';
  if (query.includes('최소') || query.includes('최저')) return 'min';
  return 'sum';
}

/** 그룹 기준 추출 */
function extractGroupBy(query: string, dataSources: DataSourceMeta[]): string | undefined {
  const groupKeywords = ['별', '단위', '기준'];
  for (const source of dataSources) {
    for (const field of source.fields) {
      if (field.type === 'nominal' || field.type === 'ordinal') {
        for (const kw of groupKeywords) {
          if (query.includes(field.name + kw) || query.includes(field.description + kw)) {
            return field.name;
          }
        }
      }
    }
  }
  return undefined;
}

/** 신뢰도 계산 */
function calculateConfidence(intent: VisualizationIntent, entities: ExtractedEntity[]): number {
  let confidence = 0.3; // 기본
  if (entities.length > 0) confidence += 0.3;
  if (entities.some((e) => e.type === 'metric')) confidence += 0.2;
  if (entities.some((e) => e.type === 'dimension')) confidence += 0.1;
  if (intent !== 'comparison') confidence += 0.1; // 기본값이 아닌 명시적 의도
  return Math.min(1, confidence);
}

// -- §3 차트 타입 추천 ────────────────────────────────────────────────────────

/** 의도-차트 매핑 규칙 */
const INTENT_CHART_MAP: Record<VisualizationIntent, ChartType[]> = {
  trend: ['line', 'area'],
  comparison: ['bar', 'table'],
  distribution: ['bar', 'scatter'],
  composition: ['pie', 'donut', 'treemap'],
  relationship: ['scatter', 'heatmap'],
  geospatial: ['heatmap', 'table'],
};

/** 최적 차트 타입 추천 -- FR-N266.3 */
export function recommendChartType(
  parseResult: NLParseResult
): { primary: ChartType; alternatives: ChartType[] } {
  const candidates = INTENT_CHART_MAP[parseResult.intent] || ['bar'];
  const metrics = parseResult.entities.filter((e) => e.type === 'metric');
  const dimensions = parseResult.entities.filter((e) => e.type === 'dimension');

  let primary: ChartType = candidates[0] ?? 'bar';

  // 메트릭이 1개이고 차원이 없으면 gauge
  if (metrics.length === 1 && dimensions.length === 0) {
    primary = 'gauge';
  }
  // 메트릭이 2개 이상이면 scatter (관계 분석)
  if (metrics.length >= 2 && parseResult.intent === 'relationship') {
    primary = 'scatter';
  }
  // 단계 데이터면 funnel
  if (parseResult.entities.some((e) => e.text.includes('단계') || e.text.includes('퍼널'))) {
    primary = 'funnel';
  }

  const alternatives = candidates.filter((c) => c !== primary);
  return { primary, alternatives };
}

// -- §4 Vega-Lite 스펙 생성 ──────────────────────────────────────────────────

/** Vega-Lite 시각화 스펙 생성 -- FR-N266.4 */
export function generateVegaLiteSpec(
  parseResult: NLParseResult,
  chartType: ChartType,
  data: unknown[],
  title: string
): VegaLiteSpec {
  const xField = parseResult.groupBy
    || parseResult.entities.find((e) => e.type === 'dimension')?.mappedField
    || 'category';
  const yField = parseResult.entities.find((e) => e.type === 'metric')?.mappedField || 'value';

  const encoding: Record<string, unknown> = {};

  switch (chartType) {
    case 'bar':
      encoding.x = { field: xField, type: 'nominal', title: xField };
      encoding.y = { field: yField, type: 'quantitative', title: yField };
      encoding.color = { field: xField, type: 'nominal' };
      break;
    case 'line':
    case 'area':
      encoding.x = { field: xField, type: 'temporal', title: xField };
      encoding.y = { field: yField, type: 'quantitative', title: yField };
      break;
    case 'pie':
    case 'donut':
      encoding.theta = { field: yField, type: 'quantitative' };
      encoding.color = { field: xField, type: 'nominal' };
      break;
    case 'scatter':
      encoding.x = { field: xField, type: 'quantitative' };
      encoding.y = { field: yField, type: 'quantitative' };
      break;
    case 'heatmap':
      encoding.x = { field: xField, type: 'nominal' };
      encoding.y = { field: yField, type: 'nominal' };
      encoding.color = { field: 'value', type: 'quantitative' };
      break;
    default:
      encoding.x = { field: xField, type: 'nominal' };
      encoding.y = { field: yField, type: 'quantitative' };
  }

  return {
    $schema: 'https://vega.github.io/schema/vega-lite/v5.json',
    title,
    width: 400,
    height: 300,
    mark: { type: chartType === 'donut' ? 'arc' : chartType, tooltip: true },
    encoding,
    data: { values: data },
  };
}

// -- §5 대시보드 레이아웃 ─────────────────────────────────────────────────────

const dashboards = new Map<string, DashboardLayout>();

/** 대시보드 생성 -- FR-N266.5 */
export function createDashboard(
  title: string,
  specs: VegaLiteSpec[],
  columns: number = 2,
  actor: string
): DashboardLayout {
  const charts: DashboardChart[] = specs.map((spec, idx) => ({
    id: randomUUID(),
    spec,
    gridPosition: {
      row: Math.floor(idx / columns),
      col: idx % columns,
      width: 1,
      height: 1,
    },
  }));

  const dashboard: DashboardLayout = {
    id: randomUUID(),
    title,
    charts,
    columns,
    createdAt: new Date().toISOString(),
  };

  dashboards.set(dashboard.id, dashboard);

  recordAudit('DASHBOARD_CREATED', title, actor);
  return dashboard;
}

/** 대시보드 조회 */
export function getDashboard(id: string): DashboardLayout | undefined {
  return dashboards.get(id);
}

/** 대시보드 목록 */
export function listDashboards(): DashboardLayout[] {
  return Array.from(dashboards.values());
}

// -- 통합 파이프라인 ──────────────────────────────────────────────────────────

/** NL 질의 → 시각화 스펙 전체 파이프라인 */
export function nlToVisualization(params: {
  query: string;
  dataSources: DataSourceMeta[];
  data: unknown[];
  actor: string;
}): {
  parseResult: NLParseResult;
  chartRecommendation: { primary: ChartType; alternatives: ChartType[] };
  spec: VegaLiteSpec;
} {
  const parseResult = parseNLQuery(params.query, params.dataSources);
  const chartRecommendation = recommendChartType(parseResult);
  const spec = generateVegaLiteSpec(
    parseResult,
    chartRecommendation.primary,
    params.data,
    params.query
  );

  recordAudit('NL_VISUALIZATION', params.query, params.actor, chartRecommendation.primary);

  return { parseResult, chartRecommendation, spec };
}
