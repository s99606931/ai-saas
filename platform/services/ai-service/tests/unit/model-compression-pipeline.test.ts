// MTU-N389 단위 테스트
import { describe, it, expect } from 'vitest';
import {
  recommendPruningRatio,
  planCompression,
  validateCompression,
  getCompressionAuditLog,
  ModelCompressionPipelineService,
  type ModelProfile,
} from '../../src/lib/model-compression-pipeline';

const original: ModelProfile = { name: 'bert-base', sizeMb: 400, accuracy: 0.92, latencyMs: 100 };

describe('MTU-N389 ModelCompressionPipeline', () => {
  it('프루닝 비율 추천', () => {
    const ratio = recommendPruningRatio(original, 200);
    expect(ratio).toBe(0.5);
  });

  it('목표 크기가 원본보다 크면 0', () => {
    const ratio = recommendPruningRatio(original, 500);
    expect(ratio).toBe(0);
  });

  it('압축 계획 - pruning', () => {
    const plan = planCompression(original, 200, 'pruning');
    expect(plan.strategy).toBe('pruning');
    expect(plan.steps.length).toBeGreaterThan(0);
  });

  it('압축 계획 - distillation', () => {
    const plan = planCompression(original, 200, 'distillation');
    expect(plan.strategy).toBe('distillation');
  });

  it('압축 계획 - quantization', () => {
    const plan = planCompression(original, 200, 'quantization');
    expect(plan.expectedAccuracyDrop).toBeLessThan(0.05);
  });

  it('압축 계획 - hybrid', () => {
    const plan = planCompression(original, 200, 'hybrid');
    expect(plan.steps.length).toBe(3);
  });

  it('검증 - 정상 압축', () => {
    const compressed: ModelProfile = { name: 'bert-small', sizeMb: 200, accuracy: 0.90, latencyMs: 50 };
    const report = validateCompression('t1', original, compressed);
    expect(report.passed).toBe(true);
    expect(report.sizeReductionPct).toBe(50);
  });

  it('검증 - 정확도 과도 저하', () => {
    const compressed: ModelProfile = { name: 'x', sizeMb: 200, accuracy: 0.70, latencyMs: 50 };
    const report = validateCompression('t1', original, compressed);
    expect(report.passed).toBe(false);
  });

  it('검증 - 사이즈 변화 없음', () => {
    const same: ModelProfile = { name: 'x', sizeMb: 400, accuracy: 0.92, latencyMs: 100 };
    const report = validateCompression('t1', original, same);
    expect(report.passed).toBe(false);
  });

  it('서비스 클래스', () => {
    const svc = new ModelCompressionPipelineService('t2');
    const plan = svc.plan(original, 200);
    expect(plan).toBeDefined();
  });

  it('감사 로그 테넌트 격리', () => {
    validateCompression('tA', original, original);
    validateCompression('tB', original, original);
    expect(getCompressionAuditLog('tA').every((e) => e.tenantId === 'tA')).toBe(true);
  });
});
