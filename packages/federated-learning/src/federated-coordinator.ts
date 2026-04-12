/**
 * 기관 간 연합학습 조정자 (FedAvg)
 * Design Ref: MTU-N459 §3
 * Plan SC: FR-FL.1~5
 */

import { z } from 'zod';

export const ParticipantSchema = z.object({
  participantId: z.string().min(1),
  organization: z.string().min(1),
  publicKey: z.string().min(10),
  datasetSize: z.number().int().positive(),
  joinedAt: z.string(),
});

export type Participant = z.infer<typeof ParticipantSchema>;

export interface ModelUpdate {
  participantId: string;
  round: number;
  weights: number[];
  sampleCount: number;
  submittedAt: string;
}

export interface GlobalModel {
  round: number;
  weights: number[];
  createdAt: string;
}

/**
 * FedAvg 집계자 (FR-FL.3)
 */
export class FedAvgAggregator {
  aggregate(updates: ModelUpdate[]): number[] {
    if (updates.length === 0) {
      throw new Error('집계할 업데이트가 없습니다');
    }
    const firstWeights = updates[0]?.weights ?? [];
    const dim = firstWeights.length;
    if (dim === 0) throw new Error('가중치 차원이 0입니다');

    const totalSamples = updates.reduce((s, u) => s + u.sampleCount, 0);
    if (totalSamples === 0) throw new Error('샘플 수가 0입니다');

    const aggregated = new Array<number>(dim).fill(0);
    for (const update of updates) {
      if (update.weights.length !== dim) {
        throw new Error(`가중치 차원 불일치: ${update.participantId}`);
      }
      const weight = update.sampleCount / totalSamples;
      for (let i = 0; i < dim; i++) {
        const cur = aggregated[i] ?? 0;
        const w = update.weights[i] ?? 0;
        aggregated[i] = cur + w * weight;
      }
    }
    return aggregated;
  }
}

/**
 * 라운드 관리 + 수렴성 모니터링 (FR-FL.2, FR-FL.4)
 */
export class FederatedCoordinator {
  private participants = new Map<string, Participant>();
  private rounds: GlobalModel[] = [];
  private updates = new Map<number, ModelUpdate[]>();
  private aggregator = new FedAvgAggregator();

  /**
   * 참여자 등록 (FR-FL.1)
   */
  registerParticipant(p: Participant): void {
    const validated = ParticipantSchema.parse(p);
    this.participants.set(validated.participantId, validated);
  }

  /**
   * 초기 글로벌 모델 (라운드 0)
   */
  initializeModel(initialWeights: number[]): GlobalModel {
    const model: GlobalModel = {
      round: 0,
      weights: [...initialWeights],
      createdAt: new Date().toISOString(),
    };
    this.rounds.push(model);
    return model;
  }

  /**
   * 로컬 업데이트 수집
   */
  submitUpdate(update: ModelUpdate): void {
    if (!this.participants.has(update.participantId)) {
      throw new Error(`미등록 참여자: ${update.participantId}`);
    }
    const list = this.updates.get(update.round) ?? [];
    list.push({ ...update, weights: [...update.weights] });
    this.updates.set(update.round, list);
  }

  /**
   * 라운드 종료 + 집계
   */
  finalizeRound(round: number, minParticipants = 2): GlobalModel {
    const updates = this.updates.get(round) ?? [];
    if (updates.length < minParticipants) {
      throw new Error(`최소 참여자 미달 (${updates.length} < ${minParticipants})`);
    }
    const aggregated = this.aggregator.aggregate(updates);
    const model: GlobalModel = {
      round: round + 1,
      weights: aggregated,
      createdAt: new Date().toISOString(),
    };
    this.rounds.push(model);
    return model;
  }

  /**
   * 수렴성 체크 (L2 거리)
   */
  checkConvergence(threshold = 0.01): {
    converged: boolean;
    distance: number;
    roundsCompleted: number;
  } {
    if (this.rounds.length < 2) {
      return { converged: false, distance: Infinity, roundsCompleted: this.rounds.length };
    }
    const prev = this.rounds[this.rounds.length - 2]?.weights ?? [];
    const curr = this.rounds[this.rounds.length - 1]?.weights ?? [];
    let sumSq = 0;
    for (let i = 0; i < Math.min(prev.length, curr.length); i++) {
      const diff = (curr[i] ?? 0) - (prev[i] ?? 0);
      sumSq += diff * diff;
    }
    const distance = Math.sqrt(sumSq);
    return {
      converged: distance < threshold,
      distance,
      roundsCompleted: this.rounds.length,
    };
  }

  /**
   * 기여도 측정 (FR-FL.5)
   */
  contributionReport(): Array<{ participantId: string; contributions: number }> {
    const counts = new Map<string, number>();
    for (const list of this.updates.values()) {
      for (const u of list) {
        counts.set(u.participantId, (counts.get(u.participantId) ?? 0) + 1);
      }
    }
    return Array.from(counts.entries()).map(([participantId, contributions]) => ({
      participantId,
      contributions,
    }));
  }

  getLatestModel(): GlobalModel | undefined {
    return this.rounds[this.rounds.length - 1];
  }
}
