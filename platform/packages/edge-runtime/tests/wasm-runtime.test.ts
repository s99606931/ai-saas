// Test Ref: MTU-N467 §wasm-runtime
import { describe, it, expect } from 'vitest';
import {
  validateManifest,
  enforcePolicy,
  EdgeDeploymentQueue,
  RuntimeMetricAggregator,
  type WasmManifest,
  type SandboxPolicy,
} from '../src/index.js';

const goodManifest: WasmManifest = {
  name: 'auth-edge',
  version: '1.0.0',
  sha256: 'a'.repeat(64),
  capabilities: ['http_client', 'kv_read'],
  limits: { memoryMb: 64, cpuMs: 1000 },
  entryPoint: 'main',
  author: 'public-saas',
};

const policy: SandboxPolicy = {
  allowedCapabilities: new Set(['http_client', 'kv_read', 'kv_write']),
  denyNetworkCidr: ['10.0.0.0/8'],
  maxMemoryMb: 128,
  maxCpuMs: 2000,
  maxPayloadBytes: 1_000_000,
};

describe('validateManifest — FR-WASM.1', () => {
  it('유효 매니페스트', () => {
    expect(validateManifest(goodManifest)).toEqual([]);
  });

  it('잘못된 해시/버전 탐지', () => {
    const bad = { ...goodManifest, sha256: 'short', version: 'x' };
    const errs = validateManifest(bad);
    expect(errs).toContain('invalid_sha256');
    expect(errs).toContain('invalid_version');
  });

  it('메모리 범위 초과', () => {
    const bad = { ...goodManifest, limits: { memoryMb: 8192, cpuMs: 1000 } };
    expect(validateManifest(bad)).toContain('memory_out_of_range');
  });
});

describe('enforcePolicy — FR-WASM.2/3', () => {
  it('허용 기능만 통과', () => {
    expect(enforcePolicy(goodManifest, policy)).toEqual([]);
  });

  it('금지 기능 탐지', () => {
    const bad = { ...goodManifest, capabilities: ['fs_write' as const] };
    expect(enforcePolicy(bad, policy)).toContain('capability_denied:fs_write');
  });

  it('메모리 초과 탐지', () => {
    const bad = { ...goodManifest, limits: { memoryMb: 256, cpuMs: 1000 } };
    expect(enforcePolicy(bad, policy)).toContain('memory_limit_exceeded');
  });
});

describe('EdgeDeploymentQueue — FR-WASM.4', () => {
  it('정상 배포 큐 진입 + 활성화', () => {
    const q = new EdgeDeploymentQueue();
    const e = q.enqueue(goodManifest, 'edge-1', policy);
    expect(e.status).toBe('queued');
    const activated = q.markActive(e.id);
    expect(activated.status).toBe('active');
  });

  it('정책 위반 시 failed', () => {
    const q = new EdgeDeploymentQueue();
    const bad = { ...goodManifest, capabilities: ['fs_write' as const] };
    const e = q.enqueue(bad, 'edge-1', policy);
    expect(e.status).toBe('failed');
    expect(() => q.markActive(e.id)).toThrow();
  });
});

describe('RuntimeMetricAggregator — FR-WASM.5', () => {
  it('메트릭 집계 + p95', () => {
    const agg = new RuntimeMetricAggregator();
    for (let i = 1; i <= 100; i++) {
      agg.record('mod-a', i, 32, false);
    }
    agg.record('mod-a', 500, 32, true);
    const m = agg.aggregate('mod-a');
    expect(m?.invocations).toBe(101);
    expect(m?.errors).toBe(1);
    expect(m?.p95CpuMs).toBeGreaterThanOrEqual(95);
  });

  it('데이터 없으면 null', () => {
    const agg = new RuntimeMetricAggregator();
    expect(agg.aggregate('none')).toBeNull();
  });
});
