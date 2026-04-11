// 공공데이터 포털 연동 분석 엔진 -- FR-N285.1~FR-N285.6
// Design Ref: MTU-N285 DESIGN §1~§6
// Plan SC: SC-1 (수집 자동화 90%+), SC-2 (분석 시간 50% 단축), SC-3 (API 키 100%), SC-4 (감사 100%)
// CSAP: D-06 감사 로그, D-08 접근 통제, D-09 암호화, D-12 개발 보안
// N2SF: O등급 공공데이터, API 키 보호, PII 마스킹

// -- 타입 정의 ────────────────────────────────────────────────────────────────

/** 공공데이터 소스 유형 */
export type DataSourceType =
  | 'data_go_kr'            // 공공데이터포털 (data.go.kr)
  | 'kosis'                 // 국가통계포털 (kosis.kr)
  | 'local_gov'             // 지자체 데이터
  | 'custom_api';           // 사용자 지정 API

/** 데이터 형식 */
export type DataFormat = 'json' | 'xml' | 'csv' | 'excel';

/** API 커넥터 설정 */
export interface APIConnectorConfig {
  readonly connectorId: string;
  readonly tenantId: string;
  readonly sourceType: DataSourceType;
  readonly baseUrl: string;
  readonly apiKeyEnvVar: string;   // 환경변수명 (하드코딩 금지)
  readonly defaultFormat: DataFormat;
  readonly rateLimitPerMinute: number;
  readonly retryCount: number;
  readonly timeoutMs: number;
}

/** 데이터 수집 요청 */
export interface DataCollectionRequest {
  readonly requestId: string;
  readonly connectorId: string;
  readonly tenantId: string;
  readonly endpoint: string;
  readonly parameters: Record<string, string>;
  readonly format: DataFormat;
  readonly scheduledAt?: string;
}

/** 수집 결과 */
export interface DataCollectionResult {
  readonly requestId: string;
  readonly connectorId: string;
  readonly status: 'success' | 'partial' | 'failed';
  readonly recordCount: number;
  readonly dataSize: number;       // bytes
  readonly normalizedRecords: NormalizedRecord[];
  readonly errors: string[];
  readonly collectedAt: string;
  readonly processingTimeMs: number;
}

/** 정규화된 레코드 */
export interface NormalizedRecord {
  readonly recordId: string;
  readonly sourceType: DataSourceType;
  readonly category: string;
  readonly period: string;          // 기간 (YYYY, YYYY-MM, etc)
  readonly region?: string;         // 지역
  readonly indicator: string;       // 지표명
  readonly value: number;
  readonly unit: string;
  readonly metadata: Record<string, string>;
}

/** 트렌드 분석 결과 */
export interface TrendAnalysisResult {
  readonly analysisId: string;
  readonly indicator: string;
  readonly period: string;
  readonly dataPoints: DataPoint[];
  readonly trend: 'increasing' | 'decreasing' | 'stable' | 'fluctuating';
  readonly changeRate: number;      // 변화율 (%)
  readonly forecast: DataPoint[];   // 예측 데이터
  readonly insights: string[];
  readonly analyzedAt: string;
}

/** 데이터 포인트 */
export interface DataPoint {
  readonly date: string;
  readonly value: number;
  readonly label?: string;
}

/** 시각화 데이터 */
export interface VisualizationData {
  readonly chartType: 'line' | 'bar' | 'pie' | 'area' | 'scatter';
  readonly title: string;
  readonly xAxis: { label: string; values: string[] };
  readonly yAxis: { label: string; unit: string };
  readonly series: ChartSeries[];
}

/** 차트 시리즈 */
export interface ChartSeries {
  readonly name: string;
  readonly data: number[];
  readonly color?: string;
}

/** 감사 로그 */
export interface PublicDataAuditEntry {
  readonly timestamp: string;
  readonly actor: string;
  readonly tenantId: string;
  readonly action: string;
  readonly target: string;
  readonly details: Record<string, unknown>;
}

// -- PII 마스킹 ────────────────────────────────────────────────────────────────

/** PII 마스킹 -- N2SF 필수. Phase 2 공공데이터 분석 시 사용. */
export function maskPublicDataPII(text: string): string {
  return text
    .replace(/\d{6}[-]?\d{7}/g, '[주민번호-마스킹]')
    .replace(/\d{3}[-.]?\d{3,4}[-.]?\d{4}/g, '[전화번호-마스킹]')
    .replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, '[이메일-마스킹]');
}

// -- 감사 로그 ────────────────────────────────────────────────────────────────

const auditLog: PublicDataAuditEntry[] = [];

function recordAudit(entry: Omit<PublicDataAuditEntry, 'timestamp'>): void {
  auditLog.push({ ...entry, timestamp: new Date().toISOString() });
}

export function getPublicDataAuditLog(tenantId: string): readonly PublicDataAuditEntry[] {
  return auditLog.filter(e => e.tenantId === tenantId);
}

// -- API 커넥터 관리 ──────────────────────────────────────────────────────────

const connectors: Map<string, APIConnectorConfig> = new Map();

/** 기본 커넥터 설정 */
const DEFAULT_CONNECTORS: Record<DataSourceType, Omit<APIConnectorConfig, 'connectorId' | 'tenantId' | 'apiKeyEnvVar'>> = {
  data_go_kr: {
    sourceType: 'data_go_kr',
    baseUrl: 'https://apis.data.go.kr',
    defaultFormat: 'json',
    rateLimitPerMinute: 30,
    retryCount: 3,
    timeoutMs: 10000,
  },
  kosis: {
    sourceType: 'kosis',
    baseUrl: 'https://kosis.kr/openapi',
    defaultFormat: 'json',
    rateLimitPerMinute: 20,
    retryCount: 3,
    timeoutMs: 15000,
  },
  local_gov: {
    sourceType: 'local_gov',
    baseUrl: 'https://openapi.gg.go.kr',
    defaultFormat: 'json',
    rateLimitPerMinute: 10,
    retryCount: 2,
    timeoutMs: 10000,
  },
  custom_api: {
    sourceType: 'custom_api',
    baseUrl: '',
    defaultFormat: 'json',
    rateLimitPerMinute: 60,
    retryCount: 3,
    timeoutMs: 10000,
  },
};

/** API 커넥터 등록 -- FR-N285.1, FR-N285.2 */
export function registerConnector(
  tenantId: string,
  sourceType: DataSourceType,
  apiKeyEnvVar: string,
  customBaseUrl?: string,
): APIConnectorConfig {
  const connectorId = `conn-${sourceType}-${Date.now()}`;
  const defaults = DEFAULT_CONNECTORS[sourceType];
  const config: APIConnectorConfig = {
    ...defaults,
    connectorId,
    tenantId,
    apiKeyEnvVar,
    baseUrl: customBaseUrl ?? defaults.baseUrl,
  };

  connectors.set(connectorId, config);

  recordAudit({
    actor: 'system',
    tenantId,
    action: 'CONNECTOR_REGISTERED',
    target: connectorId,
    details: { sourceType, baseUrl: config.baseUrl },
  });

  return config;
}

/** 커넥터 목록 조회 */
export function listConnectors(tenantId: string): APIConnectorConfig[] {
  return Array.from(connectors.values()).filter(c => c.tenantId === tenantId);
}

// -- 데이터 수집 ──────────────────────────────────────────────────────────────

/** 데이터 수집 (시뮬레이션) -- FR-N285.1~FR-N285.3 */
export function collectData(
  tenantId: string,
  userId: string,
  connectorId: string,
  endpoint: string,
  parameters: Record<string, string> = {},
  format: DataFormat = 'json',
): DataCollectionResult {
  const connector = connectors.get(connectorId);
  const startTime = Date.now();

  if (!connector) {
    return {
      requestId: `req-${Date.now()}`,
      connectorId,
      status: 'failed',
      recordCount: 0,
      dataSize: 0,
      normalizedRecords: [],
      errors: ['커넥터를 찾을 수 없습니다'],
      collectedAt: new Date().toISOString(),
      processingTimeMs: Date.now() - startTime,
    };
  }

  // API 키 확인 (환경변수에서 -- 하드코딩 금지)
  const apiKey = process.env[connector.apiKeyEnvVar];
  if (!apiKey) {
    recordAudit({
      actor: userId,
      tenantId,
      action: 'DATA_COLLECTION_FAILED',
      target: connectorId,
      details: { reason: 'API 키 미설정', envVar: connector.apiKeyEnvVar },
    });

    return {
      requestId: `req-${Date.now()}`,
      connectorId,
      status: 'failed',
      recordCount: 0,
      dataSize: 0,
      normalizedRecords: [],
      errors: [`API 키 환경변수 '${connector.apiKeyEnvVar}'가 설정되지 않았습니다`],
      collectedAt: new Date().toISOString(),
      processingTimeMs: Date.now() - startTime,
    };
  }

  // 시뮬레이션 데이터 생성
  const sampleRecords = generateSampleRecords(connector.sourceType, endpoint, parameters);

  const requestId = `req-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const result: DataCollectionResult = {
    requestId,
    connectorId,
    status: 'success',
    recordCount: sampleRecords.length,
    dataSize: JSON.stringify(sampleRecords).length,
    normalizedRecords: sampleRecords,
    errors: [],
    collectedAt: new Date().toISOString(),
    processingTimeMs: Date.now() - startTime,
  };

  recordAudit({
    actor: userId,
    tenantId,
    action: 'DATA_COLLECTED',
    target: requestId,
    details: {
      connectorId,
      endpoint,
      format,
      recordCount: sampleRecords.length,
    },
  });

  return result;
}

/** 시뮬레이션 데이터 생성 */
function generateSampleRecords(
  sourceType: DataSourceType,
  endpoint: string,
  parameters: Record<string, string>,
): NormalizedRecord[] {
  const category = parameters['category'] ?? endpoint.split('/').pop() ?? 'general';
  const records: NormalizedRecord[] = [];

  for (let i = 0; i < 12; i++) {
    const year = 2024;
    const month = (i + 1).toString().padStart(2, '0');
    records.push({
      recordId: `rec-${Date.now()}-${i}`,
      sourceType,
      category,
      period: `${year}-${month}`,
      region: parameters['region'] ?? '전국',
      indicator: parameters['indicator'] ?? '공공서비스 이용률',
      value: Math.round(50 + Math.random() * 50),
      unit: '%',
      metadata: { source: sourceType, endpoint },
    });
  }

  return records;
}

// -- 트렌드 분석 ──────────────────────────────────────────────────────────────

/** AI 기반 트렌드 분석 -- FR-N285.4 */
export function analyzeTrend(
  tenantId: string,
  userId: string,
  records: NormalizedRecord[],
  indicator: string,
): TrendAnalysisResult {
  const analysisId = `trend-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  // 데이터 포인트 추출
  const dataPoints: DataPoint[] = records
    .filter(r => r.indicator === indicator || indicator === '')
    .sort((a, b) => a.period.localeCompare(b.period))
    .map(r => ({
      date: r.period,
      value: r.value,
      label: r.region,
    }));

  if (dataPoints.length === 0) {
    return {
      analysisId,
      indicator,
      period: '',
      dataPoints: [],
      trend: 'stable',
      changeRate: 0,
      forecast: [],
      insights: ['분석할 데이터가 충분하지 않습니다'],
      analyzedAt: new Date().toISOString(),
    };
  }

  // 트렌드 판정
  const firstHalf = dataPoints.slice(0, Math.floor(dataPoints.length / 2));
  const secondHalf = dataPoints.slice(Math.floor(dataPoints.length / 2));
  const avgFirst = firstHalf.reduce((sum, p) => sum + p.value, 0) / Math.max(1, firstHalf.length);
  const avgSecond = secondHalf.reduce((sum, p) => sum + p.value, 0) / Math.max(1, secondHalf.length);
  const changeRate = avgFirst > 0 ? ((avgSecond - avgFirst) / avgFirst) * 100 : 0;

  let trend: TrendAnalysisResult['trend'] = 'stable';
  if (changeRate > 10) trend = 'increasing';
  else if (changeRate < -10) trend = 'decreasing';
  else {
    const variance = dataPoints.reduce((sum, p) => sum + Math.pow(p.value - avgSecond, 2), 0) / dataPoints.length;
    if (Math.sqrt(variance) > avgSecond * 0.3) trend = 'fluctuating';
  }

  // 예측 (단순 선형 회귀)
  const lastDataPoint = dataPoints[dataPoints.length - 1];
  const firstDataPoint = dataPoints[0];
  const lastValue = lastDataPoint?.value ?? 0;
  const monthlyChange = changeRate / Math.max(1, dataPoints.length);
  const forecast: DataPoint[] = [];
  for (let i = 1; i <= 3; i++) {
    forecast.push({
      date: `예측-${i}개월후`,
      value: Math.round(lastValue * (1 + monthlyChange * i / 100)),
    });
  }

  // 인사이트 생성
  const insights: string[] = [];
  if (trend === 'increasing') {
    insights.push(`${indicator} 지표가 상승 추세입니다 (변화율: ${changeRate.toFixed(1)}%)`);
  } else if (trend === 'decreasing') {
    insights.push(`${indicator} 지표가 하락 추세입니다 (변화율: ${changeRate.toFixed(1)}%)`);
  } else if (trend === 'fluctuating') {
    insights.push(`${indicator} 지표가 변동성이 높습니다. 안정화 방안 검토가 필요합니다`);
  }
  const firstDate = firstDataPoint?.date ?? '';
  const lastDate = lastDataPoint?.date ?? '';
  insights.push(`분석 기간: ${firstDate} ~ ${lastDate}`);
  insights.push(`데이터 포인트: ${dataPoints.length}개`);

  const result: TrendAnalysisResult = {
    analysisId,
    indicator: indicator || (records[0]?.indicator ?? ''),
    period: `${firstDate} ~ ${lastDate}`,
    dataPoints,
    trend,
    changeRate: Math.round(changeRate * 100) / 100,
    forecast,
    insights,
    analyzedAt: new Date().toISOString(),
  };

  recordAudit({
    actor: userId,
    tenantId,
    action: 'TREND_ANALYZED',
    target: analysisId,
    details: { indicator, trend, changeRate: result.changeRate, dataPointCount: dataPoints.length },
  });

  return result;
}

// -- 시각화 데이터 생성 ──────────────────────────────────────────────────────

/** 시각화 데이터 생성 -- FR-N285.5 */
export function generateVisualization(
  trendResult: TrendAnalysisResult,
  chartType: VisualizationData['chartType'] = 'line',
): VisualizationData {
  const allPoints = [...trendResult.dataPoints, ...trendResult.forecast];

  return {
    chartType,
    title: `${trendResult.indicator} 트렌드 분석`,
    xAxis: { label: '기간', values: allPoints.map(p => p.date) },
    yAxis: { label: trendResult.indicator, unit: '' },
    series: [
      {
        name: '실측값',
        data: trendResult.dataPoints.map(p => p.value),
        color: '#2563eb',
      },
      {
        name: '예측값',
        data: [
          ...trendResult.dataPoints.map(() => 0),
          ...trendResult.forecast.map(p => p.value),
        ],
        color: '#f59e0b',
      },
    ],
  };
}

/** 공공데이터 포털 서비스 */
export class PublicDataPortalService {
  constructor(private readonly tenantId: string) {}

  registerConnector(sourceType: DataSourceType, apiKeyEnvVar: string): APIConnectorConfig {
    return registerConnector(this.tenantId, sourceType, apiKeyEnvVar);
  }

  listConnectors(): APIConnectorConfig[] {
    return listConnectors(this.tenantId);
  }

  collect(userId: string, connectorId: string, endpoint: string, params?: Record<string, string>): DataCollectionResult {
    return collectData(this.tenantId, userId, connectorId, endpoint, params);
  }

  analyzeTrend(userId: string, records: NormalizedRecord[], indicator: string): TrendAnalysisResult {
    return analyzeTrend(this.tenantId, userId, records, indicator);
  }

  visualize(trendResult: TrendAnalysisResult, chartType?: VisualizationData['chartType']): VisualizationData {
    return generateVisualization(trendResult, chartType);
  }

  getAuditLog(): readonly PublicDataAuditEntry[] {
    return getPublicDataAuditLog(this.tenantId);
  }
}
