// Design Ref: MTU-N467 §wasm-runtime
// Plan SC: FR-WASM.1 ~ FR-WASM.5
//
// WASM 엣지 모듈 매니페스트 + 샌드박스 정책 + 리소스 제한 + 배포 큐 + 런타임 메트릭.
// 런타임 자체는 플랫폼 외부(WasmEdge/wasmtime)에서 실행 — 이 모듈은 관리 계층.

export type WasmCapability =
  | 'http_client'
  | 'kv_read'
  | 'kv_write'
  | 'timer'
  | 'crypto_sign'
  | 'fs_read'
  | 'fs_write';

export interface WasmManifest {
  name: string;
  version: string;
  sha256: string;
  capabilities: WasmCapability[];
  limits: {
    memoryMb: number;
    cpuMs: number;
    maxExecutions?: number;
  };
  entryPoint: string;
  author: string;
}

export interface SandboxPolicy {
  allowedCapabilities: Set<WasmCapability>;
  denyNetworkCidr: string[];
  maxMemoryMb: number;
  maxCpuMs: number;
  maxPayloadBytes: number;
}

export interface DeploymentEntry {
  id: string;
  manifest: WasmManifest;
  target: string; // edge node id
  status: 'queued' | 'deploying' | 'active' | 'failed';
  queuedAt: string;
  activatedAt?: string;
  reason?: string;
}

export interface RuntimeMetric {
  moduleName: string;
  invocations: number;
  avgCpuMs: number;
  p95CpuMs: number;
  memoryPeakMb: number;
  errors: number;
}

// FR-WASM.1: 매니페스트 검증
export function validateManifest(m: WasmManifest): string[] {
  const errors: string[] = [];
  if (!/^[a-z0-9-]+$/.test(m.name)) errors.push('invalid_name');
  if (!/^\d+\.\d+\.\d+$/.test(m.version)) errors.push('invalid_version');
  if (!/^[a-f0-9]{64}$/.test(m.sha256)) errors.push('invalid_sha256');
  if (m.limits.memoryMb <= 0 || m.limits.memoryMb > 4096) errors.push('memory_out_of_range');
  if (m.limits.cpuMs <= 0 || m.limits.cpuMs > 60_000) errors.push('cpu_out_of_range');
  if (!m.entryPoint) errors.push('missing_entry_point');
  return errors;
}

// FR-WASM.2 + FR-WASM.3: 샌드박스 정책 검사
export function enforcePolicy(manifest: WasmManifest, policy: SandboxPolicy): string[] {
  const violations: string[] = [];
  for (const cap of manifest.capabilities) {
    if (!policy.allowedCapabilities.has(cap)) {
      violations.push(`capability_denied:${cap}`);
    }
  }
  if (manifest.limits.memoryMb > policy.maxMemoryMb) {
    violations.push('memory_limit_exceeded');
  }
  if (manifest.limits.cpuMs > policy.maxCpuMs) {
    violations.push('cpu_limit_exceeded');
  }
  return violations;
}

// FR-WASM.4: 엣지 배포 큐
export class EdgeDeploymentQueue {
  private entries: DeploymentEntry[] = [];
  private nextId = 1;

  enqueue(manifest: WasmManifest, target: string, policy: SandboxPolicy): DeploymentEntry {
    const errors = [...validateManifest(manifest), ...enforcePolicy(manifest, policy)];
    const entry: DeploymentEntry = {
      id: `dep-${this.nextId++}`,
      manifest,
      target,
      status: errors.length > 0 ? 'failed' : 'queued',
      queuedAt: new Date().toISOString(),
      reason: errors.length > 0 ? errors.join(',') : undefined,
    };
    this.entries.push(entry);
    return { ...entry };
  }

  markActive(id: string): DeploymentEntry {
    const e = this.entries.find((x) => x.id === id);
    if (!e) throw new Error(`Deployment not found: ${id}`);
    if (e.status === 'failed') throw new Error(`Cannot activate failed deployment: ${id}`);
    e.status = 'active';
    e.activatedAt = new Date().toISOString();
    return { ...e };
  }

  list(): DeploymentEntry[] {
    return this.entries.map((e) => ({ ...e }));
  }
}

// FR-WASM.5: 런타임 메트릭 집계
export class RuntimeMetricAggregator {
  private events: Array<{ module: string; cpuMs: number; memMb: number; error: boolean }> = [];

  record(module: string, cpuMs: number, memMb: number, error: boolean = false): void {
    this.events.push({ module, cpuMs, memMb, error });
  }

  aggregate(module: string): RuntimeMetric | null {
    const e = this.events.filter((x) => x.module === module);
    if (e.length === 0) return null;
    const sorted = [...e].sort((a, b) => a.cpuMs - b.cpuMs);
    const p95idx = Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95));
    const avg = e.reduce((s, x) => s + x.cpuMs, 0) / e.length;
    return {
      moduleName: module,
      invocations: e.length,
      avgCpuMs: round3(avg),
      p95CpuMs: round3(sorted[p95idx].cpuMs),
      memoryPeakMb: round3(Math.max(...e.map((x) => x.memMb))),
      errors: e.filter((x) => x.error).length,
    };
  }
}

function round3(n: number): number {
  return Math.round(n * 1000) / 1000;
}
