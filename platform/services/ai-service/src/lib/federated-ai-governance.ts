// Design Ref: MTU-N445 §연합 AI 거버넌스
// Plan SC: FR-N445.1~5

export interface FederatedNode {
  nodeId: string;
  agencyName: string;
  publicKeyFingerprint: string;
  registeredAt: string;
}

export interface ModelVersion {
  modelId: string;
  version: string;
  weights: number[];
  round: number;
  contributingNodes: string[];
}

export interface NodeUpdate {
  nodeId: string;
  weights: number[];
  sampleCount: number;
}

export interface ContributionScore {
  nodeId: string;
  score: number;
}

export interface GovernanceAudit {
  eventType: 'register' | 'upload' | 'aggregate' | 'publish';
  nodeId?: string;
  round?: number;
  timestamp: string;
}

export class FederatedAiGovernance {
  /** FR-N445.1 노드 등록 */
  registerNode(
    existing: FederatedNode[],
    node: Omit<FederatedNode, 'registeredAt'>,
    timestamp: string,
  ): FederatedNode[] {
    if (existing.some((n) => n.nodeId === node.nodeId)) {
      throw new Error(`이미 등록된 노드: ${node.nodeId}`);
    }
    return [...existing, { ...node, registeredAt: timestamp }];
  }

  /** FR-N445.2 모델 버전 레지스트리 */
  publishVersion(versions: ModelVersion[], version: ModelVersion): ModelVersion[] {
    return [...versions, version];
  }

  /** FR-N445.3 연합 평균 집계 */
  aggregateFedAvg(updates: NodeUpdate[]): number[] {
    if (updates.length === 0) return [];
    const totalSamples = updates.reduce<number>((a, u) => a + u.sampleCount, 0);
    const firstUpdate = updates[0];
    if (!firstUpdate) return [];
    const dim = firstUpdate.weights.length;
    const result: number[] = new Array<number>(dim).fill(0);
    for (const u of updates) {
      if (u.weights.length !== dim) throw new Error('가중치 차원 불일치');
      const ratio = u.sampleCount / totalSamples;
      for (let i = 0; i < dim; i++) {
        const cur = result[i] ?? 0;
        const w = u.weights[i] ?? 0;
        result[i] = cur + w * ratio;
      }
    }
    return result.map((r) => +r.toFixed(6));
  }

  /** FR-N445.4 기여도 계산 (샘플 비율 + 분산 감소 기여) */
  computeContributions(updates: NodeUpdate[]): ContributionScore[] {
    const totalSamples = updates.reduce<number>((a, u) => a + u.sampleCount, 0);
    if (totalSamples === 0) return updates.map((u) => ({ nodeId: u.nodeId, score: 0 }));
    const scores = updates.map((u) => ({
      nodeId: u.nodeId,
      score: +(u.sampleCount / totalSamples).toFixed(4),
    }));
    // 정규화 (합 = 1 보장)
    const sum = scores.reduce<number>((a, s) => a + s.score, 0);
    if (sum > 0) {
      for (const s of scores) s.score = +(s.score / sum).toFixed(4);
    }
    return scores;
  }

  /** FR-N445.5 감사 이벤트 */
  audit(eventType: GovernanceAudit['eventType'], timestamp: string, extras: Partial<GovernanceAudit> = {}): GovernanceAudit {
    return { eventType, timestamp, ...extras };
  }
}

export const federatedAiGovernance = new FederatedAiGovernance();
