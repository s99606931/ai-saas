// Design Ref: MTU-N462 §FL 감사 + 기여도
// Plan SC: FR-FLA.1~5

export interface RoundAuditEntry {
  round: number;
  clientId: string;
  updateHash: string;
  sampleCount: number;
  lossDelta: number;
  at: string;
}

export interface ContributionScore {
  clientId: string;
  shapleyApprox: number;
  rank: number;
}

export interface AnomalyFlag {
  clientId: string;
  round: number;
  reason: string;
}

export interface Reward {
  clientId: string;
  amount: number;
  share: number;
}

export class FlAuditContribution {
  private entries: RoundAuditEntry[] = [];

  /** FR-FLA.1 라운드 감사 엔트리 기록 */
  append(entry: Omit<RoundAuditEntry, 'at'>): RoundAuditEntry {
    const full: RoundAuditEntry = { ...entry, at: new Date().toISOString() };
    this.entries.push(full);
    return full;
  }

  getEntries(): RoundAuditEntry[] {
    return [...this.entries];
  }

  /** FR-FLA.2 Shapley 근사 (lossDelta 기반 기여도) */
  computeShapley(clientIds: string[]): ContributionScore[] {
    const totals = new Map<string, number>();
    for (const id of clientIds) totals.set(id, 0);
    for (const e of this.entries) {
      totals.set(e.clientId, (totals.get(e.clientId) ?? 0) + e.lossDelta * e.sampleCount);
    }
    const sumAll = Array.from(totals.values()).reduce((s, v) => s + Math.max(v, 0), 0);
    const scores = Array.from(totals.entries()).map(([clientId, total]) => ({
      clientId,
      shapleyApprox: sumAll === 0 ? 0 : +(Math.max(total, 0) / sumAll).toFixed(4),
      rank: 0,
    }));
    scores.sort((a, b) => b.shapleyApprox - a.shapleyApprox);
    scores.forEach((s, i) => (s.rank = i + 1));
    return scores;
  }

  /** FR-FLA.3 참여자 ranking */
  rankClients(scores: ContributionScore[]): ContributionScore[] {
    return [...scores].sort((a, b) => a.rank - b.rank);
  }

  /** FR-FLA.4 이상 업데이트 탐지 (음의 lossDelta, 샘플 수 이상) */
  detectAnomalies(threshold = -0.1): AnomalyFlag[] {
    const flags: AnomalyFlag[] = [];
    for (const e of this.entries) {
      if (e.lossDelta < threshold) {
        flags.push({ clientId: e.clientId, round: e.round, reason: `lossDelta ${e.lossDelta}` });
      }
    }
    return flags;
  }

  /** FR-FLA.5 보상 계산 */
  calculateRewards(scores: ContributionScore[], totalPool: number): Reward[] {
    return scores.map((s) => ({
      clientId: s.clientId,
      amount: +(totalPool * s.shapleyApprox).toFixed(2),
      share: s.shapleyApprox,
    }));
  }
}

export const flAuditContribution = new FlAuditContribution();
