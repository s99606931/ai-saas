// 모델 압축 파이프라인 -- FR-N389.1~FR-N389.5
// Design Ref: MTU-N389 | CSAP: D-06

export type CompressionStrategy = 'pruning' | 'distillation' | 'quantization' | 'hybrid';

export interface ModelProfile {
  readonly name: string;
  readonly sizeMb: number;
  readonly accuracy: number;
  readonly latencyMs: number;
}

export interface CompressionPlan {
  readonly strategy: CompressionStrategy;
  readonly expectedSizeReduction: number;
  readonly expectedAccuracyDrop: number;
  readonly expectedLatencyReduction: number;
  readonly steps: readonly string[];
}

export interface CompressionReport {
  readonly original: ModelProfile;
  readonly compressed: ModelProfile;
  readonly sizeReductionPct: number;
  readonly accuracyDropPct: number;
  readonly latencyReductionPct: number;
  readonly passed: boolean;
}

export interface CompressionAuditEntry {
  readonly timestamp: string;
  readonly actor: string;
  readonly tenantId: string;
  readonly action: string;
  readonly target: string;
  readonly details: Record<string, unknown>;
}

const auditLog: CompressionAuditEntry[] = [];

function recordAudit(entry: Omit<CompressionAuditEntry, 'timestamp'>): void {
  auditLog.push({ ...entry, timestamp: new Date().toISOString() });
}

export function getCompressionAuditLog(tenantId: string): readonly CompressionAuditEntry[] {
  return auditLog.filter((e) => e.tenantId === tenantId);
}

export function recommendPruningRatio(profile: ModelProfile, targetSizeMb: number): number {
  if (targetSizeMb >= profile.sizeMb) return 0;
  return 1 - targetSizeMb / profile.sizeMb;
}

export function planCompression(
  profile: ModelProfile,
  targetSizeMb: number,
  strategy: CompressionStrategy = 'hybrid',
): CompressionPlan {
  const sizeReduction = Math.min(0.9, (profile.sizeMb - targetSizeMb) / profile.sizeMb);
  let accuracyDrop = 0;
  const steps: string[] = [];

  switch (strategy) {
    case 'pruning':
      accuracyDrop = sizeReduction * 0.05;
      steps.push('가중치 중요도 분석', '하위 가중치 제거', '미세 조정');
      break;
    case 'distillation':
      accuracyDrop = sizeReduction * 0.03;
      steps.push('Teacher 모델 설정', 'Student 모델 학습', '로짓 매칭');
      break;
    case 'quantization':
      accuracyDrop = 0.02;
      steps.push('FP→INT 변환', '캘리브레이션');
      break;
    case 'hybrid':
      accuracyDrop = sizeReduction * 0.04;
      steps.push('프루닝', '증류', '양자화');
      break;
  }

  return {
    strategy,
    expectedSizeReduction: sizeReduction,
    expectedAccuracyDrop: accuracyDrop,
    expectedLatencyReduction: sizeReduction * 0.6,
    steps,
  };
}

export function validateCompression(
  tenantId: string,
  original: ModelProfile,
  compressed: ModelProfile,
  maxAccuracyDropPct = 5,
): CompressionReport {
  const sizeReductionPct = ((original.sizeMb - compressed.sizeMb) / original.sizeMb) * 100;
  const accuracyDropPct = ((original.accuracy - compressed.accuracy) / original.accuracy) * 100;
  const latencyReductionPct = ((original.latencyMs - compressed.latencyMs) / original.latencyMs) * 100;
  const passed = accuracyDropPct <= maxAccuracyDropPct && sizeReductionPct > 0;

  recordAudit({
    actor: 'system',
    tenantId,
    action: 'COMPRESSION_VALIDATED',
    target: original.name,
    details: { sizeReductionPct, accuracyDropPct, passed },
  });

  return {
    original,
    compressed,
    sizeReductionPct,
    accuracyDropPct,
    latencyReductionPct,
    passed,
  };
}

export class ModelCompressionPipelineService {
  constructor(private readonly tenantId: string) {}
  recommendRatio(profile: ModelProfile, targetSizeMb: number): number {
    return recommendPruningRatio(profile, targetSizeMb);
  }
  plan(profile: ModelProfile, targetSizeMb: number, strategy: CompressionStrategy = 'hybrid'): CompressionPlan {
    return planCompression(profile, targetSizeMb, strategy);
  }
  validate(original: ModelProfile, compressed: ModelProfile, maxDrop = 5): CompressionReport {
    return validateCompression(this.tenantId, original, compressed, maxDrop);
  }
  getAuditLog(): readonly CompressionAuditEntry[] {
    return getCompressionAuditLog(this.tenantId);
  }
}
