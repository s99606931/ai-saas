// Design Ref: MTU-N483 §마이크로서비스 오케스트레이션
// Plan SC: FR-OR.1~5

export interface ServiceNode {
  id: string;
  name: string;
  dependencies: string[];
}

export interface CallChain {
  traceId: string;
  services: string[];
  latencyMs: number;
  status: 'ok' | 'error';
}

export interface RetryPolicy {
  serviceId: string;
  maxAttempts: number;
  backoffMs: number;
}

export interface LoadBalanceStrategy {
  serviceId: string;
  algorithm: 'round-robin' | 'least-connections' | 'weighted';
  weights?: Record<string, number>;
}

export interface CanaryRoute {
  serviceId: string;
  stableVersion: string;
  canaryVersion: string;
  canaryWeight: number;
}

export class OrchestrationAi {
  private topology = new Map<string, ServiceNode>();

  /** FR-OR.1 토폴로지 맵 */
  registerService(node: ServiceNode): void {
    this.topology.set(node.id, node);
  }

  getTopology(): ServiceNode[] {
    return Array.from(this.topology.values());
  }

  /** FR-OR.2 호출 체인 분석 */
  analyzeChain(chains: CallChain[]): { avgLatency: number; errorRate: number; hotPath: string[] } {
    if (chains.length === 0) return { avgLatency: 0, errorRate: 0, hotPath: [] };
    const avgLatency = chains.reduce((s, c) => s + c.latencyMs, 0) / chains.length;
    const errorRate = chains.filter((c) => c.status === 'error').length / chains.length;
    const counts = new Map<string, number>();
    for (const c of chains) {
      for (const s of c.services) counts.set(s, (counts.get(s) ?? 0) + 1);
    }
    const hotPath = Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([s]) => s);
    return { avgLatency: +avgLatency.toFixed(2), errorRate: +errorRate.toFixed(3), hotPath };
  }

  /** FR-OR.3 재시도 정책 */
  recommendRetry(errorRate: number, avgLatencyMs: number): RetryPolicy {
    const maxAttempts = errorRate > 0.1 ? 1 : errorRate > 0.01 ? 2 : 3;
    const backoffMs = Math.max(100, Math.ceil(avgLatencyMs / 2));
    return { serviceId: 'default', maxAttempts, backoffMs };
  }

  /** FR-OR.4 부하 분산 */
  recommendLoadBalance(serviceId: string, instances: number): LoadBalanceStrategy {
    return {
      serviceId,
      algorithm: instances > 5 ? 'least-connections' : 'round-robin',
    };
  }

  /** FR-OR.5 카나리 라우팅 */
  planCanary(serviceId: string, stable: string, canary: string, initialPct = 5): CanaryRoute {
    return { serviceId, stableVersion: stable, canaryVersion: canary, canaryWeight: initialPct };
  }

  rollForward(current: CanaryRoute, step = 10): CanaryRoute {
    return { ...current, canaryWeight: Math.min(100, current.canaryWeight + step) };
  }
}

export const orchestrationAi = new OrchestrationAi();
