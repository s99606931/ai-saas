// MTU-N389 모델 압축 파이프라인 테스트
import { describe, it, expect } from 'vitest';
import { ModelCompressionPipelineService, type ModelProfile } from '../model-compression-pipeline.js';

describe('MTU-N389 ModelCompressionPipeline', () => {
  const svc = new ModelCompressionPipelineService('tenant-n389');

  const original: ModelProfile = { name: 'bert-base', sizeMb: 440, accuracy: 0.92, latencyMs: 120 };

  it('FR-N389.1: 프루닝 비율 추천', () => {
    const ratio = svc.recommendRatio(original, 220);
    expect(ratio).toBeCloseTo(0.5, 1);
  });

  it('FR-N389.2: 압축 계획', () => {
    const plan = svc.plan(original, 220, 'hybrid');
    expect(plan.steps.length).toBeGreaterThan(0);
    expect(plan.expectedSizeReduction).toBeGreaterThan(0);
  });

  it('FR-N389.3: 품질 검증 PASS', () => {
    const compressed: ModelProfile = { name: 'bert-compressed', sizeMb: 200, accuracy: 0.9, latencyMs: 60 };
    const report = svc.validate(original, compressed, 5);
    expect(report.passed).toBe(true);
  });

  it('FR-N389.4: 품질 저하 FAIL', () => {
    const bad: ModelProfile = { name: 'bad', sizeMb: 100, accuracy: 0.7, latencyMs: 50 };
    const report = svc.validate(original, bad, 5);
    expect(report.passed).toBe(false);
  });

  it('FR-N389.5: 감사 로그', () => {
    expect(svc.getAuditLog().length).toBeGreaterThan(0);
  });
});
