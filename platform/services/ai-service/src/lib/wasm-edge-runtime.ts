// Design Ref: MTU-N467 §WebAssembly 엣지 런타임
// Plan SC: FR-WASM.1~5

export interface WasmManifest {
  moduleId: string;
  name: string;
  version: string;
  entrypoint: string;
  capabilities: string[];
  hash: string;
}

export interface SandboxPolicy {
  moduleId: string;
  allowNetwork: boolean;
  allowFilesystem: boolean;
  allowedHosts: string[];
}

export interface ResourceLimit {
  moduleId: string;
  maxMemoryMb: number;
  maxCpuMs: number;
  maxExecutionMs: number;
}

export interface EdgeDeployment {
  moduleId: string;
  edgeNodeId: string;
  status: 'queued' | 'deploying' | 'ready' | 'failed';
  queuedAt: string;
}

export interface RuntimeMetric {
  moduleId: string;
  invocations: number;
  avgLatencyMs: number;
  errors: number;
}

export class WasmEdgeRuntime {
  private manifests = new Map<string, WasmManifest>();
  private policies = new Map<string, SandboxPolicy>();
  private limits = new Map<string, ResourceLimit>();
  private deployments: EdgeDeployment[] = [];
  private metrics = new Map<string, RuntimeMetric>();

  /** FR-WASM.1 매니페스트 등록 */
  registerManifest(m: WasmManifest): WasmManifest {
    this.manifests.set(m.moduleId, m);
    return m;
  }

  /** FR-WASM.2 샌드박스 정책 */
  setPolicy(policy: SandboxPolicy): SandboxPolicy {
    if (!this.manifests.has(policy.moduleId)) throw new Error('매니페스트 없음');
    this.policies.set(policy.moduleId, policy);
    return policy;
  }

  /** FR-WASM.3 리소스 제한 */
  setLimit(limit: ResourceLimit): ResourceLimit {
    if (!this.manifests.has(limit.moduleId)) throw new Error('매니페스트 없음');
    if (limit.maxMemoryMb > 256) throw new Error('메모리 256MB 초과');
    this.limits.set(limit.moduleId, limit);
    return limit;
  }

  /** FR-WASM.4 엣지 배포 큐 */
  queueDeployment(moduleId: string, edgeNodeId: string): EdgeDeployment {
    if (!this.manifests.has(moduleId)) throw new Error('매니페스트 없음');
    const d: EdgeDeployment = { moduleId, edgeNodeId, status: 'queued', queuedAt: new Date().toISOString() };
    this.deployments.push(d);
    return d;
  }

  getDeployments(): EdgeDeployment[] {
    return [...this.deployments];
  }

  /** FR-WASM.5 런타임 메트릭 */
  recordInvocation(moduleId: string, latencyMs: number, error = false): void {
    const m = this.metrics.get(moduleId) ?? { moduleId, invocations: 0, avgLatencyMs: 0, errors: 0 };
    const total = m.avgLatencyMs * m.invocations + latencyMs;
    m.invocations += 1;
    m.avgLatencyMs = +(total / m.invocations).toFixed(2);
    if (error) m.errors += 1;
    this.metrics.set(moduleId, m);
  }

  getMetric(moduleId: string): RuntimeMetric | undefined {
    return this.metrics.get(moduleId);
  }
}

export const wasmEdgeRuntime = new WasmEdgeRuntime();
