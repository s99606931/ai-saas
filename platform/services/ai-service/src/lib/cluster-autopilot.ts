// Design Ref: MTU-N470 §클러스터 오토파일럿
// Plan SC: FR-CAP.1~5

export interface NodeUsageSample {
  nodeId: string;
  cpuPct: number;
  memPct: number;
  timestamp: string;
}

export interface ScalingRecommendation {
  workload: string;
  currentReplicas: number;
  recommendedReplicas: number;
  reason: string;
}

export interface PodPlacement {
  podName: string;
  targetNode: string;
  affinityScore: number;
}

export interface CostOptimization {
  workload: string;
  spotEligible: boolean;
  estimatedSavingsPct: number;
}

export class ClusterAutopilot {
  /** FR-CAP.1 노드 리소스 예측 (단순 이동평균) */
  forecastUsage(samples: NodeUsageSample[], window = 5): { cpuAvg: number; memAvg: number } {
    const recent = samples.slice(-window);
    if (recent.length === 0) return { cpuAvg: 0, memAvg: 0 };
    const cpu = recent.reduce((s, x) => s + x.cpuPct, 0) / recent.length;
    const mem = recent.reduce((s, x) => s + x.memPct, 0) / recent.length;
    return { cpuAvg: +cpu.toFixed(2), memAvg: +mem.toFixed(2) };
  }

  /** FR-CAP.2 HPA/VPA 추천 */
  recommendScaling(
    workload: string,
    current: number,
    usagePct: number,
  ): ScalingRecommendation {
    let recommended = current;
    let reason = '변경 없음';
    if (usagePct > 80) {
      recommended = Math.min(current + Math.ceil(current * 0.5), 50);
      reason = `사용률 ${usagePct}% (scale out)`;
    } else if (usagePct < 30 && current > 2) {
      recommended = Math.max(Math.floor(current * 0.7), 2);
      reason = `사용률 ${usagePct}% (scale in)`;
    }
    return { workload, currentReplicas: current, recommendedReplicas: recommended, reason };
  }

  /** FR-CAP.3 Pod 배치 최적화 */
  placePods(podName: string, nodes: NodeUsageSample[]): PodPlacement {
    // 가장 여유 있는 노드 선택
    const best = [...nodes].sort((a, b) => a.cpuPct + a.memPct - (b.cpuPct + b.memPct))[0];
    const score = best ? +(1 - (best.cpuPct + best.memPct) / 200).toFixed(3) : 0;
    return { podName, targetNode: best?.nodeId ?? 'unknown', affinityScore: score };
  }

  /** FR-CAP.4 비용 최적화 (spot 추천) */
  recommendSpot(workload: string, critical: boolean, usageVariance: number): CostOptimization {
    const spotEligible = !critical && usageVariance < 0.3;
    const estimatedSavingsPct = spotEligible ? 70 : 0;
    return { workload, spotEligible, estimatedSavingsPct };
  }

  /** FR-CAP.5 리소스 이력 대시보드 데이터 */
  buildDashboardData(samples: NodeUsageSample[]): Array<{ timestamp: string; cpu: number; mem: number }> {
    return samples.map((s) => ({ timestamp: s.timestamp, cpu: s.cpuPct, mem: s.memPct }));
  }
}

export const clusterAutopilot = new ClusterAutopilot();
