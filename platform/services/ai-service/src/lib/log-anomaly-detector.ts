// 로그 이상 패턴 탐지 -- FR-N308.1~FR-N308.6
// Design Ref: MTU-N308 DESIGN §1~§6
// Plan SC: SC-1 (탐지율 85%+), SC-2 (오탐 15%), SC-3 (탐지지연 30초), SC-4 (감사 100%)
// CSAP: D-06 감사 로그

// -- 타입 정의 ────────────────────────────────────────────────────────────────

/** 로그 레벨 */
export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'fatal';

/** 정규화된 로그 엔트리 */
export interface NormalizedLogEntry {
  readonly logId: string;
  readonly timestamp: string;
  readonly service: string;
  readonly level: LogLevel;
  readonly message: string;
  readonly metadata: Record<string, unknown>;
}

/** 기준선 패턴 */
export interface BaselinePattern {
  readonly service: string;
  readonly avgErrorRate: number;
  readonly avgLogVolume: number;
  readonly peakHours: number[];
  readonly commonPatterns: string[];
  readonly updatedAt: string;
}

/** 로그 이상 */
export interface LogAnomaly {
  readonly anomalyId: string;
  readonly tenantId: string;
  readonly service: string;
  readonly anomalyType: 'error_spike' | 'volume_spike' | 'new_pattern' | 'silence' | 'repeated_error';
  readonly severity: 'critical' | 'high' | 'medium' | 'low';
  readonly description: string;
  readonly affectedLogs: string[];
  readonly detectedAt: string;
}

/** 상관 분석 결과 */
export interface LogCorrelation {
  readonly correlationId: string;
  readonly tenantId: string;
  readonly relatedAnomalies: string[];
  readonly rootCauseEstimate: string;
  readonly affectedServices: string[];
  readonly confidence: number;
  readonly analyzedAt: string;
}

/** 감사 로그 */
export interface LogDetectorAuditEntry {
  readonly timestamp: string;
  readonly actor: string;
  readonly tenantId: string;
  readonly action: string;
  readonly target: string;
  readonly details: Record<string, unknown>;
}

// -- 감사 로그 ────────────────────────────────────────────────────────────────

const auditLog: LogDetectorAuditEntry[] = [];

function recordAudit(entry: Omit<LogDetectorAuditEntry, 'timestamp'>): void {
  auditLog.push({ ...entry, timestamp: new Date().toISOString() });
}

export function getLogDetectorAuditLog(tenantId: string): readonly LogDetectorAuditEntry[] {
  return auditLog.filter(e => e.tenantId === tenantId);
}

// -- 로그 정규화 ──────────────────────────────────────────────────────────────

/** 로그 수집 및 정규화 -- FR-N308.1 */
export function normalizeLogEntries(
  rawLogs: Array<{ timestamp: string; service: string; level: string; message: string; meta?: Record<string, unknown> }>,
): NormalizedLogEntry[] {
  return rawLogs.map(log => ({
    logId: `log-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    timestamp: log.timestamp,
    service: log.service,
    level: normalizeLevel(log.level),
    message: log.message,
    metadata: log.meta ?? {},
  }));
}

function normalizeLevel(level: string): LogLevel {
  const lower = level.toLowerCase();
  if (lower === 'fatal' || lower === 'critical' || lower === 'emergency') return 'fatal';
  if (lower === 'error' || lower === 'err') return 'error';
  if (lower === 'warn' || lower === 'warning') return 'warn';
  if (lower === 'info' || lower === 'information') return 'info';
  return 'debug';
}

// -- 기준선 학습 ──────────────────────────────────────────────────────────────

const baselineStore: Map<string, BaselinePattern> = new Map();

/** 정상 패턴 기준선 학습 -- FR-N308.2 */
export function learnBaseline(
  tenantId: string,
  service: string,
  logs: NormalizedLogEntry[],
): BaselinePattern {
  const serviceLogs = logs.filter(l => l.service === service);
  const errorLogs = serviceLogs.filter(l => l.level === 'error' || l.level === 'fatal');
  const errorRate = serviceLogs.length > 0 ? errorLogs.length / serviceLogs.length : 0;

  // 시간대별 로그 분포
  const hourCounts: number[] = new Array(24).fill(0) as number[];
  for (const log of serviceLogs) {
    const hour = new Date(log.timestamp).getHours();
    const currentCount = hourCounts[hour];
    if (currentCount !== undefined) {
      hourCounts[hour] = currentCount + 1;
    }
  }

  const avgCount = serviceLogs.length / 24;
  const peakHours = hourCounts
    .map((count, hour) => ({ hour, count }))
    .filter(h => h.count > avgCount * 1.5)
    .map(h => h.hour);

  // 공통 패턴 추출
  const patternCounts = new Map<string, number>();
  for (const log of serviceLogs) {
    const pattern = log.message.replace(/\d+/g, 'N').replace(/[a-f0-9]{8,}/gi, 'HASH').slice(0, 50);
    patternCounts.set(pattern, (patternCounts.get(pattern) ?? 0) + 1);
  }
  const commonPatterns = [...patternCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([pattern]) => pattern);

  const baseline: BaselinePattern = {
    service,
    avgErrorRate: errorRate,
    avgLogVolume: serviceLogs.length,
    peakHours,
    commonPatterns,
    updatedAt: new Date().toISOString(),
  };

  baselineStore.set(`${tenantId}:${service}`, baseline);

  recordAudit({
    actor: 'system',
    tenantId,
    action: 'BASELINE_LEARNED',
    target: service,
    details: { logCount: serviceLogs.length, errorRate, patternsLearned: commonPatterns.length },
  });

  return baseline;
}

// -- 이상 탐지 ────────────────────────────────────────────────────────────────

/** 이상 패턴 실시간 탐지 -- FR-N308.3 */
export function detectLogAnomalies(
  tenantId: string,
  service: string,
  recentLogs: NormalizedLogEntry[],
): LogAnomaly[] {
  const baseline = baselineStore.get(`${tenantId}:${service}`);
  const anomalies: LogAnomaly[] = [];

  const serviceLogs = recentLogs.filter(l => l.service === service);
  const errorLogs = serviceLogs.filter(l => l.level === 'error' || l.level === 'fatal');
  const currentErrorRate = serviceLogs.length > 0 ? errorLogs.length / serviceLogs.length : 0;

  if (!baseline) {
    // 기준선 없으면 기본 임계값 사용
    if (currentErrorRate > 0.1) {
      anomalies.push({
        anomalyId: `anom-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        tenantId,
        service,
        anomalyType: 'error_spike',
        severity: currentErrorRate > 0.3 ? 'critical' : 'high',
        description: `에러율 급증: ${(currentErrorRate * 100).toFixed(1)}% (기준선 미설정)`,
        affectedLogs: errorLogs.slice(0, 5).map(l => l.logId),
        detectedAt: new Date().toISOString(),
      });
    }
    return anomalies;
  }

  // 에러율 급증
  if (currentErrorRate > baseline.avgErrorRate * 2 && currentErrorRate > 0.05) {
    anomalies.push({
      anomalyId: `anom-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      tenantId,
      service,
      anomalyType: 'error_spike',
      severity: currentErrorRate > baseline.avgErrorRate * 5 ? 'critical' : 'high',
      description: `에러율 급증: ${(currentErrorRate * 100).toFixed(1)}% (기준: ${(baseline.avgErrorRate * 100).toFixed(1)}%)`,
      affectedLogs: errorLogs.slice(0, 5).map(l => l.logId),
      detectedAt: new Date().toISOString(),
    });
  }

  // 로그 볼륨 급증
  if (serviceLogs.length > baseline.avgLogVolume * 3) {
    anomalies.push({
      anomalyId: `anom-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      tenantId,
      service,
      anomalyType: 'volume_spike',
      severity: 'medium',
      description: `로그 볼륨 급증: ${serviceLogs.length}건 (기준: ${baseline.avgLogVolume}건)`,
      affectedLogs: serviceLogs.slice(0, 3).map(l => l.logId),
      detectedAt: new Date().toISOString(),
    });
  }

  // 침묵 (로그 없음)
  if (serviceLogs.length === 0 && baseline.avgLogVolume > 10) {
    anomalies.push({
      anomalyId: `anom-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      tenantId,
      service,
      anomalyType: 'silence',
      severity: 'high',
      description: `로그 침묵: ${service}에서 로그 수신 없음 (기준: ${baseline.avgLogVolume}건/기간)`,
      affectedLogs: [],
      detectedAt: new Date().toISOString(),
    });
  }

  // 반복 에러 패턴
  const errorMessages = new Map<string, number>();
  for (const log of errorLogs) {
    const normalized = log.message.slice(0, 50);
    errorMessages.set(normalized, (errorMessages.get(normalized) ?? 0) + 1);
  }
  for (const [msg, count] of errorMessages.entries()) {
    if (count >= 5) {
      anomalies.push({
        anomalyId: `anom-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        tenantId,
        service,
        anomalyType: 'repeated_error',
        severity: 'medium',
        description: `반복 에러: "${msg}" (${count}회 반복)`,
        affectedLogs: errorLogs.filter(l => l.message.startsWith(msg.slice(0, 30))).slice(0, 3).map(l => l.logId),
        detectedAt: new Date().toISOString(),
      });
    }
  }

  if (anomalies.length > 0) {
    recordAudit({
      actor: 'system',
      tenantId,
      action: 'LOG_ANOMALIES_DETECTED',
      target: service,
      details: { anomaliesCount: anomalies.length, logsAnalyzed: serviceLogs.length },
    });
  }

  return anomalies;
}

// -- 상관 분석 ────────────────────────────────────────────────────────────────

/** 로그 간 상관 분석 -- FR-N308.4 */
export function correlateLogAnomalies(
  tenantId: string,
  anomalies: LogAnomaly[],
): LogCorrelation | null {
  if (anomalies.length < 2) return null;

  const affectedServices = [...new Set(anomalies.map(a => a.service))];
  const hasCritical = anomalies.some(a => a.severity === 'critical');

  let rootCause = '알 수 없음';
  if (anomalies.some(a => a.anomalyType === 'error_spike')) {
    rootCause = '연쇄 에러 전파: 상위 서비스 장애 가능성';
  } else if (anomalies.some(a => a.anomalyType === 'silence')) {
    rootCause = '서비스 다운: 프로세스 종료 또는 네트워크 분리 의심';
  }

  const correlation: LogCorrelation = {
    correlationId: `corr-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    tenantId,
    relatedAnomalies: anomalies.map(a => a.anomalyId),
    rootCauseEstimate: rootCause,
    affectedServices,
    confidence: hasCritical ? 0.8 : 0.6,
    analyzedAt: new Date().toISOString(),
  };

  recordAudit({
    actor: 'system',
    tenantId,
    action: 'LOG_CORRELATION_ANALYZED',
    target: correlation.correlationId,
    details: { anomaliesCorrelated: anomalies.length, servicesAffected: affectedServices.length },
  });

  return correlation;
}

/** 로그 이상 탐지 서비스 */
export class LogAnomalyDetectorService {
  constructor(private readonly tenantId: string) {}

  normalize(rawLogs: Parameters<typeof normalizeLogEntries>[0]): NormalizedLogEntry[] {
    return normalizeLogEntries(rawLogs);
  }

  learnBaseline(service: string, logs: NormalizedLogEntry[]): BaselinePattern {
    return learnBaseline(this.tenantId, service, logs);
  }

  detect(service: string, logs: NormalizedLogEntry[]): LogAnomaly[] {
    return detectLogAnomalies(this.tenantId, service, logs);
  }

  correlate(anomalies: LogAnomaly[]): LogCorrelation | null {
    return correlateLogAnomalies(this.tenantId, anomalies);
  }

  getAuditLog(): readonly LogDetectorAuditEntry[] {
    return getLogDetectorAuditLog(this.tenantId);
  }
}
