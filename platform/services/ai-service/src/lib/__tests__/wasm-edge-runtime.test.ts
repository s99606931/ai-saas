import { describe, it, expect, beforeEach } from 'vitest';
import { WasmEdgeRuntime } from '../wasm-edge-runtime';

describe('WasmEdgeRuntime', () => {
  let svc: WasmEdgeRuntime;

  beforeEach(() => {
    svc = new WasmEdgeRuntime();
    svc.registerManifest({
      moduleId: 'w1',
      name: '이미지 분류',
      version: '1.0',
      entrypoint: '_start',
      capabilities: ['gpu'],
      hash: 'sha256:abc',
    });
  });

  it('FR-WASM.1 매니페스트 등록', () => {
    expect(() => svc.setPolicy({ moduleId: 'w1', allowNetwork: false, allowFilesystem: false, allowedHosts: [] })).not.toThrow();
  });

  it('FR-WASM.2 정책 설정', () => {
    const p = svc.setPolicy({ moduleId: 'w1', allowNetwork: true, allowFilesystem: false, allowedHosts: ['api.example.gov'] });
    expect(p.allowNetwork).toBe(true);
  });

  it('FR-WASM.3 리소스 제한 (초과 거부)', () => {
    expect(() =>
      svc.setLimit({ moduleId: 'w1', maxMemoryMb: 512, maxCpuMs: 1000, maxExecutionMs: 5000 }),
    ).toThrow();
    const ok = svc.setLimit({ moduleId: 'w1', maxMemoryMb: 128, maxCpuMs: 500, maxExecutionMs: 3000 });
    expect(ok.maxMemoryMb).toBe(128);
  });

  it('FR-WASM.4 배포 큐', () => {
    svc.queueDeployment('w1', 'edge-1');
    svc.queueDeployment('w1', 'edge-2');
    expect(svc.getDeployments().length).toBe(2);
  });

  it('FR-WASM.5 메트릭 기록', () => {
    svc.recordInvocation('w1', 100);
    svc.recordInvocation('w1', 200, true);
    const m = svc.getMetric('w1');
    expect(m?.invocations).toBe(2);
    expect(m?.errors).toBe(1);
    expect(m?.avgLatencyMs).toBe(150);
  });
});
