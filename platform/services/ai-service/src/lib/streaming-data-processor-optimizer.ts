// Design Ref: §핵심 알고리즘 — 백프레셔 감지 + 최적화 권고
// Plan SC: FR-R284.1~5

enum DataGrade { C = 'C', S = 'S', O = 'O' }

interface PipelineConfig {
  id: string;
  name: string;
  maxThroughput: number;
  maxBufferSize: number;
  backpressureThreshold: number;
}

interface ProcessingMetric {
  pipelineId: string;
  throughput: number;
  queueDepth: number;
  recordedAt: string;
}

interface BackpressureStatus {
  pipelineId: string;
  hasBackpressure: boolean;
  currentQueueDepth: number;
  maxBufferSize: number;
  fillRatio: number;
}

interface AuditEntry {
  timestamp: string;
  action: string;
  details: Record<string, unknown>;
}

// Plan SC: FR-R284.5
function guardDataGrade(grade: DataGrade): void {
  if (grade === DataGrade.C || grade === DataGrade.S) {
    throw new Error(`BLOCKED: ${grade}등급 데이터는 AI API 전송 금지 (N2SF N-05)`);
  }
}

export class StreamingDataProcessorOptimizer {
  private pipelines = new Map<string, PipelineConfig>();
  private metrics: ProcessingMetric[] = [];
  private auditLog: AuditEntry[] = [];

  private log(action: string, details: Record<string, unknown>): void {
    this.auditLog.push({ timestamp: new Date().toISOString(), action, details });
  }

  // Plan SC: FR-R284.1
  registerPipeline(id: string, name: string, maxThroughput: number, maxBufferSize: number, backpressureThreshold: number = 0.8): void {
    this.pipelines.set(id, { id, name, maxThroughput, maxBufferSize, backpressureThreshold });
    this.log('REGISTER_PIPELINE', { id, name, maxThroughput, maxBufferSize, backpressureThreshold });
  }

  // Plan SC: FR-R284.2
  recordMetrics(pipelineId: string, throughput: number, queueDepth: number, grade: DataGrade = DataGrade.O): void {
    guardDataGrade(grade);
    if (!this.pipelines.has(pipelineId)) throw new Error(`파이프라인 미등록: ${pipelineId}`);
    this.metrics.push({ pipelineId, throughput, queueDepth, recordedAt: new Date().toISOString() });
    this.log('RECORD_METRICS', { pipelineId, throughput, queueDepth });
  }

  // Plan SC: FR-R284.3
  detectBackpressure(pipelineId: string): BackpressureStatus {
    const config = this.pipelines.get(pipelineId);
    if (!config) throw new Error(`파이프라인 미등록: ${pipelineId}`);

    const pipelineMetrics = this.metrics.filter(m => m.pipelineId === pipelineId);
    const latest = pipelineMetrics[pipelineMetrics.length - 1];
    const currentQueueDepth = latest?.queueDepth ?? 0;
    const fillRatio = config.maxBufferSize === 0 ? 0 : currentQueueDepth / config.maxBufferSize;
    const hasBackpressure = fillRatio > config.backpressureThreshold;

    return { pipelineId, hasBackpressure, currentQueueDepth, maxBufferSize: config.maxBufferSize, fillRatio };
  }

  // Plan SC: FR-R284.4
  getOptimizationRecommendations(pipelineId: string): string[] {
    const config = this.pipelines.get(pipelineId);
    if (!config) throw new Error(`파이프라인 미등록: ${pipelineId}`);

    const status = this.detectBackpressure(pipelineId);
    const recommendations: string[] = [];

    if (status.hasBackpressure) {
      recommendations.push('파티션 수 확장 검토');
      recommendations.push('배치 크기 증가 검토');
    }

    const pipelineMetrics = this.metrics.filter(m => m.pipelineId === pipelineId);
    if (pipelineMetrics.length > 0) {
      const avgThroughput = pipelineMetrics.reduce((s, m) => s + m.throughput, 0) / pipelineMetrics.length;
      if (avgThroughput < config.maxThroughput * 0.5) {
        recommendations.push('소비자 스레드 증가 검토');
      }
    }

    if (recommendations.length === 0) recommendations.push('파이프라인 정상');
    return recommendations;
  }

  // Plan SC: FR-R284.5
  getAuditLog(): AuditEntry[] {
    return [...this.auditLog];
  }
}
