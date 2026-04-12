/**
 * WASM 엣지 런타임 테스트
 * Plan SC: FR-WASM.1~5
 */

import {
  WasmManifestValidator,
  ResourceLimiter,
  EdgeDeploymentQueue,
  RuntimeMetricsCollector,
  WasmModuleManifest,
} from '../src/wasm-runtime';

const sampleManifest = (overrides: Partial<WasmModuleManifest> = {}): WasmModuleManifest => ({
  moduleId: 'm1',
  name: 'classifier',
  version: '1.0.0',
  wasmUrl: 'https://cdn.example.com/m1.wasm',
  sha256: 'a'.repeat(64),
  memoryPagesMin: 1,
  memoryPagesMax: 16,
  maxCpuMs: 1000,
  allowedImports: ['wasi_snapshot_preview1', 'env'],
  author: 'team',
  signedBy: 'ca-key',
  ...overrides,
});

describe('WasmManifestValidator', () => {
  const v = new WasmManifestValidator();

  it('정상 매니페스트 valid', () => {
    expect(v.validate(sampleManifest()).valid).toBe(true);
  });

  it('memoryPagesMin > Max 시 오류', () => {
    const result = v.validate(sampleManifest({ memoryPagesMin: 100, memoryPagesMax: 10 }));
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain('memoryPages');
  });

  it('미허용 import 거부', () => {
    const result = v.validate(sampleManifest({ allowedImports: ['malicious'] }));
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain('허용되지 않은 import');
  });

  it('스키마 오류 (sha256 길이)', () => {
    const result = v.validate(sampleManifest({ sha256: 'short' }));
    expect(result.valid).toBe(false);
  });
});

describe('ResourceLimiter', () => {
  const l = new ResourceLimiter();

  it('memoryLimitMb 계산', () => {
    const m = sampleManifest({ memoryPagesMax: 32 }); // 32 * 64KB = 2048KB = 2MB
    expect(l.memoryLimitMb(m)).toBe(2);
  });

  it('정책 내 → ok', () => {
    const r = l.checkWithinPolicy(sampleManifest(), { maxMemoryMb: 100, maxCpuMs: 5000 });
    expect(r.ok).toBe(true);
  });

  it('메모리/CPU 초과 시 violations', () => {
    const r = l.checkWithinPolicy(
      sampleManifest({ memoryPagesMax: 100000, maxCpuMs: 999999 }),
      { maxMemoryMb: 1, maxCpuMs: 100 },
    );
    expect(r.ok).toBe(false);
    expect(r.violations.length).toBeGreaterThanOrEqual(2);
  });
});

describe('EdgeDeploymentQueue', () => {
  let q: EdgeDeploymentQueue;
  beforeEach(() => {
    q = new EdgeDeploymentQueue();
  });

  it('enqueue + pending', () => {
    q.enqueue('m1', ['edge-1', 'edge-2']);
    expect(q.pending().length).toBe(1);
  });

  it('markStatus active 후 pending에서 제외', () => {
    const dep = q.enqueue('m1', ['edge-1']);
    q.markStatus(dep.deploymentId, 'active');
    expect(q.pending().length).toBe(0);
  });

  it('markStatus 미존재 시 오류', () => {
    expect(() => q.markStatus('nope', 'active')).toThrow(/배포 없음/);
  });
});

describe('RuntimeMetricsCollector', () => {
  it('record + summarize', () => {
    const c = new RuntimeMetricsCollector();
    c.record({
      moduleId: 'm1',
      nodeId: 'n1',
      invocations: 100,
      avgDurationMs: 10,
      memoryPeakMb: 1,
      errorCount: 5,
      timestamp: '',
    });
    c.record({
      moduleId: 'm1',
      nodeId: 'n2',
      invocations: 50,
      avgDurationMs: 20,
      memoryPeakMb: 2,
      errorCount: 0,
      timestamp: '',
    });
    const sum = c.summarize('m1');
    expect(sum.totalInvocations).toBe(150);
    expect(sum.errorRate).toBeCloseTo(5 / 150);
  });

  it('summarize: 미존재 모듈 0', () => {
    const c = new RuntimeMetricsCollector();
    expect(c.summarize('nope').totalInvocations).toBe(0);
  });

  it('byModule 필터링', () => {
    const c = new RuntimeMetricsCollector();
    c.record({
      moduleId: 'm1',
      nodeId: 'n1',
      invocations: 1,
      avgDurationMs: 1,
      memoryPeakMb: 1,
      errorCount: 0,
      timestamp: '',
    });
    expect(c.byModule('m1').length).toBe(1);
    expect(c.byModule('m2').length).toBe(0);
  });
});
