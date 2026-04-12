// MTU-N379 LLM 양자화 최적화 테스트
import { describe, it, expect } from 'vitest';
import { LlmQuantizationOptimizerService, type ModelMeta, type HardwareProfile, type BenchmarkResult } from '../llm-quantization-optimizer.js';

describe('MTU-N379 LlmQuantizationOptimizer', () => {
  const svc = new LlmQuantizationOptimizerService('tenant-n379');

  const meta: ModelMeta = { name: 'llama-7b', paramsB: 7, contextLength: 4096, baseSizeGb: 28 };
  const hw: HardwareProfile = { gpuMemoryGb: 24, gpuCount: 1, targetLatencyMs: 500 };

  it('FR-N379.1: 양자화 계획 생성', () => {
    const plan = svc.plan(meta, hw);
    expect(['fp32', 'fp16', 'int8', 'int4']).toContain(plan.level);
    expect(plan.expectedSizeGb).toBeGreaterThan(0);
  });

  it('FR-N379.2: 배치 사이즈 최적화', () => {
    const batch = svc.optimizeBatch(meta, hw, 'int8');
    expect(batch).toBeGreaterThan(0);
  });

  it('FR-N379.3: 벤치마크 비교', () => {
    const results: BenchmarkResult[] = [
      { level: 'fp16', throughputTokPerSec: 50, qualityPct: 99 },
      { level: 'int8', throughputTokPerSec: 80, qualityPct: 96 },
    ];
    const best = svc.compare(results);
    expect(best).toBeDefined();
  });

  it('FR-N379.4: 감사 로그', () => {
    expect(svc.getAuditLog().length).toBeGreaterThan(0);
  });
});
