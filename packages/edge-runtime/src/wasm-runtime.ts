/**
 * WebAssembly 엣지 AI 런타임
 * Design Ref: MTU-N467 §3
 * Plan SC: FR-WASM.1~5
 */

import { z } from 'zod';

export const WasmModuleManifestSchema = z.object({
  moduleId: z.string().min(1),
  name: z.string().min(1),
  version: z.string().regex(/^\d+\.\d+\.\d+$/),
  wasmUrl: z.string().url(),
  sha256: z.string().length(64),
  memoryPagesMin: z.number().int().positive(),
  memoryPagesMax: z.number().int().positive(),
  maxCpuMs: z.number().int().positive(),
  allowedImports: z.array(z.string()),
  author: z.string().min(1),
  signedBy: z.string().min(1),
});

export type WasmModuleManifest = z.infer<typeof WasmModuleManifestSchema>;

export interface EdgeDeployment {
  deploymentId: string;
  moduleId: string;
  targetEdgeNodes: string[];
  status: 'pending' | 'deploying' | 'active' | 'failed';
  createdAt: string;
}

/**
 * 매니페스트 검증 + 샌드박스 정책 (FR-WASM.1, FR-WASM.2)
 */
export class WasmManifestValidator {
  private allowedImportAllowlist = new Set([
    'wasi_snapshot_preview1',
    'env',
    'ai_host_ml',
    'ai_host_log',
  ]);

  validate(manifest: WasmModuleManifest): {
    valid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];
    try {
      WasmModuleManifestSchema.parse(manifest);
    } catch (e) {
      errors.push(`스키마 오류: ${(e as Error).message}`);
      return { valid: false, errors };
    }
    if (manifest.memoryPagesMin > manifest.memoryPagesMax) {
      errors.push('memoryPagesMin > memoryPagesMax');
    }
    for (const imp of manifest.allowedImports) {
      if (!this.allowedImportAllowlist.has(imp)) {
        errors.push(`허용되지 않은 import: ${imp}`);
      }
    }
    return { valid: errors.length === 0, errors };
  }
}

/**
 * 리소스 제한 계산기 (FR-WASM.3)
 */
export class ResourceLimiter {
  private static readonly PAGE_SIZE_KB = 64;

  memoryLimitMb(manifest: WasmModuleManifest): number {
    return (manifest.memoryPagesMax * ResourceLimiter.PAGE_SIZE_KB) / 1024;
  }

  checkWithinPolicy(
    manifest: WasmModuleManifest,
    policy: { maxMemoryMb: number; maxCpuMs: number },
  ): { ok: boolean; violations: string[] } {
    const violations: string[] = [];
    const memMb = this.memoryLimitMb(manifest);
    if (memMb > policy.maxMemoryMb) {
      violations.push(`메모리 초과: ${memMb}MB > ${policy.maxMemoryMb}MB`);
    }
    if (manifest.maxCpuMs > policy.maxCpuMs) {
      violations.push(`CPU 시간 초과: ${manifest.maxCpuMs}ms > ${policy.maxCpuMs}ms`);
    }
    return { ok: violations.length === 0, violations };
  }
}

/**
 * 엣지 배포 큐 (FR-WASM.4)
 */
export class EdgeDeploymentQueue {
  private queue: EdgeDeployment[] = [];
  private seq = 0;

  enqueue(moduleId: string, edgeNodes: string[]): EdgeDeployment {
    this.seq++;
    const dep: EdgeDeployment = {
      deploymentId: `dep-${Date.now()}-${this.seq}`,
      moduleId,
      targetEdgeNodes: [...edgeNodes],
      status: 'pending',
      createdAt: new Date().toISOString(),
    };
    this.queue.push(dep);
    return dep;
  }

  markStatus(deploymentId: string, status: EdgeDeployment['status']): void {
    const dep = this.queue.find((d) => d.deploymentId === deploymentId);
    if (!dep) throw new Error(`배포 없음: ${deploymentId}`);
    dep.status = status;
  }

  pending(): EdgeDeployment[] {
    return this.queue.filter((d) => d.status === 'pending').map((d) => ({ ...d }));
  }
}

/**
 * 런타임 메트릭 (FR-WASM.5)
 */
export interface RuntimeMetric {
  moduleId: string;
  nodeId: string;
  invocations: number;
  avgDurationMs: number;
  memoryPeakMb: number;
  errorCount: number;
  timestamp: string;
}

export class RuntimeMetricsCollector {
  private metrics: RuntimeMetric[] = [];

  record(metric: RuntimeMetric): void {
    this.metrics.push({ ...metric });
  }

  byModule(moduleId: string): RuntimeMetric[] {
    return this.metrics.filter((m) => m.moduleId === moduleId).map((m) => ({ ...m }));
  }

  summarize(moduleId: string): {
    totalInvocations: number;
    avgDurationMs: number;
    errorRate: number;
  } {
    const entries = this.byModule(moduleId);
    if (entries.length === 0) {
      return { totalInvocations: 0, avgDurationMs: 0, errorRate: 0 };
    }
    const totalInvocations = entries.reduce((s, m) => s + m.invocations, 0);
    const totalDuration = entries.reduce((s, m) => s + m.avgDurationMs * m.invocations, 0);
    const totalErrors = entries.reduce((s, m) => s + m.errorCount, 0);
    return {
      totalInvocations,
      avgDurationMs: totalInvocations > 0 ? totalDuration / totalInvocations : 0,
      errorRate: totalInvocations > 0 ? totalErrors / totalInvocations : 0,
    };
  }
}
