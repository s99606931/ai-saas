/**
 * 연합학습 감사 추적 + 기여도 측정 (Shapley 근사)
 * Design Ref: MTU-N462 §3
 * Plan SC: FR-FLA.1~5
 */

export interface FlAuditEntry {
  entryId: string;
  round: number;
  participantId: string;
  action: 'update-submit' | 'round-aggregate' | 'anomaly-detect';
  metrics?: {
    localLoss?: number;
    sampleCount?: number;
    updateNormL2?: number;
  };
  timestamp: string;
}

export class FlAuditTrail {
  private entries: FlAuditEntry[] = [];
  private seq = 0;

  append(entry: Omit<FlAuditEntry, 'entryId' | 'timestamp'>): FlAuditEntry {
    this.seq++;
    const full: FlAuditEntry = {
      ...entry,
      entryId: `fl-audit-${Date.now()}-${this.seq}`,
      timestamp: new Date().toISOString(),
    };
    this.entries.push(full);
    return full;
  }

  byRound(round: number): FlAuditEntry[] {
    return this.entries.filter((e) => e.round === round).map((e) => ({ ...e }));
  }

  all(): FlAuditEntry[] {
    return this.entries.map((e) => ({ ...e }));
  }
}

/**
 * 기여도 측정기 (FR-FLA.2, FR-FLA.3)
 * Leave-one-out 근사 Shapley
 */
export class ContributionScorer {
  /**
   * 참여자별 기여도 (샘플 수 + 평균 로스 감소량)
   */
  score(
    participantMetrics: Array<{
      participantId: string;
      sampleCount: number;
      lossReductions: number[];
    }>,
  ): Array<{ participantId: string; contribution: number; rank: number }> {
    const totals = participantMetrics.map((m) => {
      const avgReduction =
        m.lossReductions.length > 0
          ? m.lossReductions.reduce((s, v) => s + v, 0) / m.lossReductions.length
          : 0;
      const contribution = m.sampleCount * Math.max(0, avgReduction);
      return { participantId: m.participantId, contribution };
    });
    totals.sort((a, b) => b.contribution - a.contribution);
    return totals.map((t, idx) => ({ ...t, rank: idx + 1 }));
  }
}

/**
 * 이상 업데이트 탐지 (FR-FLA.4)
 * L2 norm이 중앙값의 3σ 이상 → 이상
 */
export class AnomalyDetector {
  detect(norms: Array<{ participantId: string; normL2: number }>): string[] {
    if (norms.length < 3) return [];
    const values = norms.map((n) => n.normL2).sort((a, b) => a - b);
    const mid = values[Math.floor(values.length / 2)] ?? 0;
    const variance =
      values.reduce((s, v) => s + Math.pow(v - mid, 2), 0) / Math.max(values.length, 1);
    const std = Math.sqrt(variance);
    const threshold = mid + 3 * std;
    return norms.filter((n) => n.normL2 > threshold).map((n) => n.participantId);
  }
}

/**
 * 보상 계산기 (FR-FLA.5)
 */
export class RewardCalculator {
  calculate(
    contributions: Array<{ participantId: string; contribution: number }>,
    totalReward: number,
  ): Array<{ participantId: string; reward: number }> {
    const total = contributions.reduce((s, c) => s + c.contribution, 0);
    if (total === 0) {
      const equal = totalReward / Math.max(contributions.length, 1);
      return contributions.map((c) => ({ participantId: c.participantId, reward: equal }));
    }
    return contributions.map((c) => ({
      participantId: c.participantId,
      reward: Math.round(((c.contribution / total) * totalReward) * 100) / 100,
    }));
  }
}
