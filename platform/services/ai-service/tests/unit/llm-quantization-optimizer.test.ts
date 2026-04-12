// MTU-N379 단위 테스트
import { describe, it, expect } from 'vitest';
import {
  estimateSize,
  recommendLevel,
  optimizeBatchSize,
  compareBenchmarks,
  planOptimization,
  getQuantAuditLog,
  LlmQuantizationOptimizerService,
  type ModelMeta,
  type HardwareProfile,
} from '../../src/lib/llm-quantization-optimizer';

const meta: ModelMeta = {
  name: 'llama-7b',
  paramsB: 7,
  contextLength: 4096,
  baseSizeGb: 28,
};

const hwLarge: HardwareProfile = { gpuMemoryGb: 80, gpuCount: 1, targetLatencyMs: 100 };
const hwSmall: HardwareProfile = { gpuMemoryGb: 8, gpuCount: 1, targetLatencyMs: 200 };

describe('MTU-N379 LlmQuantizationOptimizer', () => {
  it('크기 추정 - fp16', () => {
    expect(estimateSize(meta, 'fp16')).toBe(14);
  });

  it('크기 추정 - int8', () => {
    expect(estimateSize(meta, 'int8')).toBe(7);
  });

  it('큰 GPU에서는 fp32 가능', () => {
    const plan = recommendLevel(meta, { gpuMemoryGb: 200, gpuCount: 1, targetLatencyMs: 100 });
    expect(plan.level).toBe('fp32');
  });

  it('작은 GPU에서는 int4', () => {
    const plan = recommendLevel(meta, hwSmall);
    expect(plan.level).toBe('int4');
  });

  it('중간 GPU에서 fp16 선택', () => {
    const plan = recommendLevel(meta, hwLarge);
    expect(['fp32', 'fp16']).toContain(plan.level);
  });

  it('int4 경고 포함', () => {
    const plan = recommendLevel(meta, hwSmall);
    expect(plan.warnings.some((w) => w.includes('INT4'))).toBe(true);
  });

  it('배치 사이즈 최적화', () => {
    const batch = optimizeBatchSize(meta, hwLarge, 'int8');
    expect(batch).toBeGreaterThan(0);
  });

  it('벤치마크 비교 - 최고 선택', () => {
    const results = [
      { level: 'fp16' as const, throughputTokPerSec: 100, qualityPct: 99 },
      { level: 'int8' as const, throughputTokPerSec: 200, qualityPct: 96 },
    ];
    const best = compareBenchmarks(results);
    expect(best).toBeDefined();
  });

  it('빈 벤치마크', () => {
    expect(compareBenchmarks([])).toBeUndefined();
  });

  it('planOptimization 감사 로그', () => {
    planOptimization('t1', meta, hwLarge);
    expect(getQuantAuditLog('t1').length).toBeGreaterThan(0);
  });

  it('서비스 클래스', () => {
    const svc = new LlmQuantizationOptimizerService('t2');
    const plan = svc.plan(meta, hwLarge);
    expect(plan.expectedQualityPct).toBeGreaterThan(0);
  });
});
