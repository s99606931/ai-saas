import { describe, it, expect } from 'vitest';
import { AiOutputWatermarking, type WatermarkMetadata } from '../ai-output-watermarking';

describe('AiOutputWatermarking', () => {
  const meta: WatermarkMetadata = { modelId: 'llama-3', timestamp: '2026-04-12T00:00:00Z', version: '1.0' };

  it('generates deterministic fingerprint', () => {
    const svc = new AiOutputWatermarking();
    const fp1 = svc.fingerprint('hello world', meta);
    const fp2 = svc.fingerprint('hello world', meta);
    expect(fp1).toBe(fp2);
  });

  it('watermarks and verifies output', () => {
    const svc = new AiOutputWatermarking();
    svc.watermark('AI 생성 문서', meta);
    const v = svc.verify('AI 생성 문서', meta);
    expect(v.matched).toBe(true);
    expect(v.confidence).toBe(1);
  });

  it('fails verification on text change', () => {
    const svc = new AiOutputWatermarking();
    svc.watermark('원본', meta);
    const v = svc.verify('수정됨', meta);
    expect(v.matched).toBe(false);
  });

  it('assesses robustness', () => {
    const svc = new AiOutputWatermarking();
    const ratio = svc.assessRobustness('hello world', 'hello_world', meta);
    expect(ratio).toBeLessThan(1);
    expect(ratio).toBeGreaterThan(0.5);
  });

  it('lists registry', () => {
    const svc = new AiOutputWatermarking();
    svc.watermark('A', meta);
    svc.watermark('B', meta);
    expect(svc.listRegistry().length).toBe(2);
  });
});
