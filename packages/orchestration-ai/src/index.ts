/**
 * 오케스트레이션·이벤트·API GW·멀티리전 파사드
 * MTU-N483~N486
 */

// ============ MTU-N483: Service Orchestration ============

export interface ServiceNode {
  serviceId: string;
  name: string;
  endpoints: string[];
}

export interface ServiceEdge {
  from: string;
  to: string;
  callCount: number;
  avgLatencyMs: number;
  errorRate: number;
}

export class ServiceTopology {
  private nodes = new Map<string, ServiceNode>();
  private edges: ServiceEdge[] = [];

  addService(node: ServiceNode): void {
    this.nodes.set(node.serviceId, node);
  }

  recordCall(edge: ServiceEdge): void {
    const existing = this.edges.find((e) => e.from === edge.from && e.to === edge.to);
    if (existing) {
      const total = existing.callCount + edge.callCount;
      existing.avgLatencyMs =
        (existing.avgLatencyMs * existing.callCount + edge.avgLatencyMs * edge.callCount) / total;
      existing.errorRate =
        (existing.errorRate * existing.callCount + edge.errorRate * edge.callCount) / total;
      existing.callCount = total;
    } else {
      this.edges.push({ ...edge });
    }
  }

  /**
   * 호출 체인에서 느린 경로 찾기
   */
  slowestPaths(limit = 5): ServiceEdge[] {
    return [...this.edges].sort((a, b) => b.avgLatencyMs - a.avgLatencyMs).slice(0, limit);
  }

  /**
   * 에러율 높은 경로
   */
  unreliablePaths(threshold = 0.05): ServiceEdge[] {
    return this.edges.filter((e) => e.errorRate > threshold);
  }

  nodeCount(): number {
    return this.nodes.size;
  }
}

// ============ MTU-N484: Event-Driven Optimizer ============

export interface TopicMetric {
  topic: string;
  partitionCount: number;
  messagesPerSec: number;
  avgMessageSizeBytes: number;
  consumerLag: number;
}

export class EventTopicOptimizer {
  /**
   * 파티션 수 추천: 10k msg/s per partition 기준
   */
  recommendPartitions(metric: TopicMetric): number {
    const recommended = Math.max(1, Math.ceil(metric.messagesPerSec / 10000));
    return Math.max(recommended, metric.partitionCount);
  }

  /**
   * 컨슈머 랙 예측 (단순 선형)
   */
  predictLag(history: number[], stepsAhead: number): number {
    if (history.length < 2) return history[history.length - 1] ?? 0;
    const first = history[0] ?? 0;
    const last = history[history.length - 1] ?? 0;
    const slope = (last - first) / history.length;
    return Math.max(0, last + slope * stepsAhead);
  }

  /**
   * 토픽 병합 추천: 유사한 처리 패턴
   */
  recommendMerge(metrics: TopicMetric[]): Array<[string, string]> {
    const pairs: Array<[string, string]> = [];
    for (let i = 0; i < metrics.length; i++) {
      for (let j = i + 1; j < metrics.length; j++) {
        const a = metrics[i];
        const b = metrics[j];
        if (!a || !b) continue;
        const rpsRatio = a.messagesPerSec / Math.max(b.messagesPerSec, 1);
        const sizeRatio = a.avgMessageSizeBytes / Math.max(b.avgMessageSizeBytes, 1);
        if (rpsRatio > 0.5 && rpsRatio < 2 && sizeRatio > 0.5 && sizeRatio < 2) {
          pairs.push([a.topic, b.topic]);
        }
      }
    }
    return pairs;
  }
}

// ============ MTU-N485: API Gateway AI ============

export type RequestClass = 'read' | 'write' | 'expensive' | 'unknown';

export interface ApiRequest {
  path: string;
  method: string;
  userId: string;
  sizeBytes: number;
}

export class ApiTrafficShaper {
  classify(request: ApiRequest): RequestClass {
    if (request.method === 'GET' || request.method === 'HEAD') return 'read';
    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(request.method)) {
      return request.sizeBytes > 1024 * 100 ? 'expensive' : 'write';
    }
    return 'unknown';
  }

  /**
   * 동적 Rate Limit: 부하 기반
   */
  computeRateLimit(currentLoadPercent: number, userTier: 'free' | 'standard' | 'premium'): number {
    const baseLimits = { free: 10, standard: 100, premium: 1000 };
    const base = baseLimits[userTier];
    if (currentLoadPercent > 90) return Math.floor(base * 0.3);
    if (currentLoadPercent > 70) return Math.floor(base * 0.6);
    return base;
  }

  /**
   * 공격 패턴 차단 (단순 규칙 기반)
   */
  isAttack(request: ApiRequest): boolean {
    if (request.path.includes('..')) return true;
    if (request.path.includes('<script')) return true;
    if (request.path.length > 2048) return true;
    return false;
  }
}

// ============ MTU-N486: Multi-Region Sync ============

export interface RegionNode {
  regionId: string;
  location: string;
  latencyToPrimaryMs: number;
}

export class MultiRegionSyncOptimizer {
  private regions = new Map<string, RegionNode>();

  addRegion(region: RegionNode): void {
    this.regions.set(region.regionId, region);
  }

  /**
   * 배치 크기 추천: 지연 시간 기반
   * 높은 지연 → 큰 배치 (왕복 횟수 감소)
   */
  recommendBatchSize(regionId: string): number {
    const region = this.regions.get(regionId);
    if (!region) return 100;
    if (region.latencyToPrimaryMs > 200) return 1000;
    if (region.latencyToPrimaryMs > 100) return 500;
    return 100;
  }

  /**
   * Last-Writer-Wins 충돌 해결
   */
  resolveConflict<T extends { updatedAt: string }>(a: T, b: T): T {
    return new Date(a.updatedAt).getTime() >= new Date(b.updatedAt).getTime() ? a : b;
  }
}
