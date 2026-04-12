/**
 * 클러스터 오토파일럿 AI
 * Design Ref: MTU-N470 §3
 * Plan SC: FR-CAP.1~5
 */

export interface NodeResourceSample {
  nodeId: string;
  timestamp: string;
  cpuUsagePercent: number;
  memoryUsagePercent: number;
  podCount: number;
}

export interface PodResourceSpec {
  podName: string;
  namespace: string;
  requestedCpuMilli: number;
  requestedMemoryMi: number;
  actualAvgCpuMilli: number;
  actualAvgMemoryMi: number;
}

/**
 * 리소스 예측기 (FR-CAP.1)
 * 단순 이동평균 + 추세
 */
export class ResourceForecaster {
  forecast(samples: NodeResourceSample[], hoursAhead: number): {
    nodeId: string;
    predictedCpuPercent: number;
    predictedMemoryPercent: number;
  }[] {
    const byNode = new Map<string, NodeResourceSample[]>();
    for (const s of samples) {
      const list = byNode.get(s.nodeId) ?? [];
      list.push(s);
      byNode.set(s.nodeId, list);
    }

    const result: Array<{
      nodeId: string;
      predictedCpuPercent: number;
      predictedMemoryPercent: number;
    }> = [];

    for (const [nodeId, list] of byNode) {
      if (list.length < 2) continue;
      // 단순 선형 추세
      const cpus = list.map((s) => s.cpuUsagePercent);
      const mems = list.map((s) => s.memoryUsagePercent);
      const cpuTrend = this.linearTrend(cpus);
      const memTrend = this.linearTrend(mems);
      const last = list[list.length - 1];
      if (!last) continue;
      result.push({
        nodeId,
        predictedCpuPercent: Math.max(
          0,
          Math.min(100, last.cpuUsagePercent + cpuTrend * hoursAhead),
        ),
        predictedMemoryPercent: Math.max(
          0,
          Math.min(100, last.memoryUsagePercent + memTrend * hoursAhead),
        ),
      });
    }
    return result;
  }

  private linearTrend(values: number[]): number {
    if (values.length < 2) return 0;
    const first = values[0] ?? 0;
    const last = values[values.length - 1] ?? 0;
    return (last - first) / values.length;
  }
}

/**
 * HPA/VPA 추천기 (FR-CAP.2, FR-CAP.3)
 */
export class AutoscalingAdvisor {
  recommendHpa(pod: PodResourceSpec): {
    minReplicas: number;
    maxReplicas: number;
    targetCpuPercent: number;
  } {
    const utilization =
      pod.requestedCpuMilli > 0 ? (pod.actualAvgCpuMilli / pod.requestedCpuMilli) * 100 : 0;
    return {
      minReplicas: 2,
      maxReplicas: utilization > 70 ? 10 : 5,
      targetCpuPercent: 70,
    };
  }

  recommendVpa(pod: PodResourceSpec): {
    cpuMilli: number;
    memoryMi: number;
  } {
    // 실사용 평균의 1.3배
    return {
      cpuMilli: Math.ceil(pod.actualAvgCpuMilli * 1.3),
      memoryMi: Math.ceil(pod.actualAvgMemoryMi * 1.3),
    };
  }
}

/**
 * Pod 배치 최적화 (FR-CAP.3)
 */
export interface NodeCandidate {
  nodeId: string;
  availableCpuMilli: number;
  availableMemoryMi: number;
  labels: Record<string, string>;
}

export class PodPlacementOptimizer {
  placePod(
    pod: PodResourceSpec,
    candidates: NodeCandidate[],
    preferredLabels: Record<string, string> = {},
  ): NodeCandidate | null {
    const eligible = candidates.filter(
      (c) =>
        c.availableCpuMilli >= pod.requestedCpuMilli &&
        c.availableMemoryMi >= pod.requestedMemoryMi,
    );
    if (eligible.length === 0) return null;

    const scored = eligible.map((c) => {
      let score = 0;
      // 여유 리소스가 적당한 노드 선호 (과도한 fragmentation 방지)
      const cpuFit = pod.requestedCpuMilli / c.availableCpuMilli;
      const memFit = pod.requestedMemoryMi / c.availableMemoryMi;
      score += (cpuFit + memFit) * 10;

      // 선호 라벨 일치
      for (const [k, v] of Object.entries(preferredLabels)) {
        if (c.labels[k] === v) score += 5;
      }
      return { candidate: c, score };
    });
    scored.sort((a, b) => b.score - a.score);
    return scored[0]?.candidate ?? null;
  }
}

/**
 * 비용 최적화 (FR-CAP.4)
 */
export class CostOptimizer {
  /**
   * Spot 인스턴스 적합성 평가
   * 상태 비저장 + 재시작 가능한 워크로드만 spot 추천
   */
  recommendSpot(workload: {
    stateful: boolean;
    restartable: boolean;
    slaLevel: 'standard' | 'critical';
  }): { useSpot: boolean; reason: string } {
    if (workload.stateful) {
      return { useSpot: false, reason: '상태 저장 워크로드는 on-demand 권장' };
    }
    if (!workload.restartable) {
      return { useSpot: false, reason: '재시작 불가 워크로드' };
    }
    if (workload.slaLevel === 'critical') {
      return { useSpot: false, reason: '중대 SLA는 안정적 인스턴스 필요' };
    }
    return { useSpot: true, reason: 'Spot 인스턴스로 최대 70% 비용 절감 가능' };
  }
}
