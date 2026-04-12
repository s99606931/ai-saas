// 온프레미스 LLM 양자화 최적화 -- FR-N379.1~FR-N379.5
// Design Ref: MTU-N379 | CSAP: D-06

export type QuantizationLevel = 'fp32' | 'fp16' | 'int8' | 'int4';

export interface ModelMeta {
  readonly name: string;
  readonly paramsB: number; // 파라미터 수 (billion)
  readonly contextLength: number;
  readonly baseSizeGb: number;
}

export interface HardwareProfile {
  readonly gpuMemoryGb: number;
  readonly gpuCount: number;
  readonly targetLatencyMs: number;
}

export interface QuantizationPlan {
  readonly level: QuantizationLevel;
  readonly expectedSizeGb: number;
  readonly expectedQualityPct: number;
  readonly recommendedBatchSize: number;
  readonly warnings: readonly string[];
}

export interface BenchmarkResult {
  readonly level: QuantizationLevel;
  readonly throughputTokPerSec: number;
  readonly qualityPct: number;
}

export interface QuantAuditEntry {
  readonly timestamp: string;
  readonly actor: string;
  readonly tenantId: string;
  readonly action: string;
  readonly target: string;
  readonly details: Record<string, unknown>;
}

const auditLog: QuantAuditEntry[] = [];

function recordAudit(entry: Omit<QuantAuditEntry, 'timestamp'>): void {
  auditLog.push({ ...entry, timestamp: new Date().toISOString() });
}

export function getQuantAuditLog(tenantId: string): readonly QuantAuditEntry[] {
  return auditLog.filter((e) => e.tenantId === tenantId);
}

const SIZE_RATIO: Record<QuantizationLevel, number> = {
  fp32: 1.0,
  fp16: 0.5,
  int8: 0.25,
  int4: 0.125,
};

const QUALITY_PCT: Record<QuantizationLevel, number> = {
  fp32: 100,
  fp16: 99,
  int8: 96,
  int4: 88,
};

export function estimateSize(meta: ModelMeta, level: QuantizationLevel): number {
  return meta.baseSizeGb * SIZE_RATIO[level];
}

export function recommendLevel(meta: ModelMeta, hw: HardwareProfile): QuantizationPlan {
  const totalMemory = hw.gpuMemoryGb * hw.gpuCount;
  const warnings: string[] = [];
  const levels: QuantizationLevel[] = ['fp32', 'fp16', 'int8', 'int4'];

  // 가장 품질 높은 레벨부터 메모리에 맞는 것 선택
  let chosen: QuantizationLevel = 'int4';
  for (const lvl of levels) {
    const size = estimateSize(meta, lvl);
    if (size * 1.3 < totalMemory) {
      // 1.3x 오버헤드 고려
      chosen = lvl;
      break;
    }
  }

  const size = estimateSize(meta, chosen);
  if (chosen === 'int4') warnings.push('INT4는 품질 저하 가능성 있음 - 검증 필수');
  if (size * 1.3 >= totalMemory) warnings.push('메모리 부족 - 추가 GPU 필요');

  const batchSize = Math.max(1, Math.floor((totalMemory - size * 1.3) / 0.5));

  return {
    level: chosen,
    expectedSizeGb: size,
    expectedQualityPct: QUALITY_PCT[chosen],
    recommendedBatchSize: batchSize,
    warnings,
  };
}

export function optimizeBatchSize(meta: ModelMeta, hw: HardwareProfile, level: QuantizationLevel): number {
  const totalMemory = hw.gpuMemoryGb * hw.gpuCount;
  const modelSize = estimateSize(meta, level);
  const available = totalMemory - modelSize * 1.3;
  const perBatchGb = (meta.paramsB * 0.05) / 8; // 추정치
  return Math.max(1, Math.floor(available / Math.max(perBatchGb, 0.1)));
}

export function compareBenchmarks(results: readonly BenchmarkResult[]): BenchmarkResult | undefined {
  if (results.length === 0) return undefined;
  // 처리량과 품질의 가중 평균
  return results.reduce((best, cur) => {
    const bestScore = best.throughputTokPerSec * 0.6 + best.qualityPct * 0.4;
    const curScore = cur.throughputTokPerSec * 0.6 + cur.qualityPct * 0.4;
    return curScore > bestScore ? cur : best;
  });
}

export function planOptimization(tenantId: string, meta: ModelMeta, hw: HardwareProfile): QuantizationPlan {
  const plan = recommendLevel(meta, hw);
  recordAudit({
    actor: 'system',
    tenantId,
    action: 'QUANTIZATION_PLAN_CREATED',
    target: meta.name,
    details: { level: plan.level, sizeGb: plan.expectedSizeGb, batchSize: plan.recommendedBatchSize },
  });
  return plan;
}

export class LlmQuantizationOptimizerService {
  constructor(private readonly tenantId: string) {}
  plan(meta: ModelMeta, hw: HardwareProfile): QuantizationPlan {
    return planOptimization(this.tenantId, meta, hw);
  }
  optimizeBatch(meta: ModelMeta, hw: HardwareProfile, level: QuantizationLevel): number {
    return optimizeBatchSize(meta, hw, level);
  }
  compare(results: readonly BenchmarkResult[]): BenchmarkResult | undefined {
    return compareBenchmarks(results);
  }
  getAuditLog(): readonly QuantAuditEntry[] {
    return getQuantAuditLog(this.tenantId);
  }
}
