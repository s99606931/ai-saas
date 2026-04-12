// Design Ref: MTU-N459 §연합학습 조정자
// Plan SC: FR-FL.1~5

export interface Participant {
  id: string;
  name: string;
  publicKey: string;
  registeredAt: string;
  active: boolean;
}

export interface ModelUpdate {
  participantId: string;
  round: number;
  weights: number[];
  sampleCount: number;
}

export interface RoundState {
  round: number;
  globalWeights: number[];
  updates: ModelUpdate[];
  completed: boolean;
  convergenceDelta?: number;
}

export interface ConvergenceMetric {
  round: number;
  delta: number;
  converged: boolean;
}

export class FederatedCoordinator {
  private participants = new Map<string, Participant>();
  private rounds: RoundState[] = [];
  private auditLog: Array<{ round: number; action: string; at: string }> = [];
  private convergenceThreshold = 0.001;

  /** FR-FL.1 참여 기관 등록 */
  registerParticipant(p: Omit<Participant, 'registeredAt' | 'active'>): Participant {
    const full: Participant = { ...p, registeredAt: new Date().toISOString(), active: true };
    this.participants.set(p.id, full);
    return full;
  }

  /** FR-FL.2 라운드 시작 */
  startRound(globalWeights: number[]): RoundState {
    const round = this.rounds.length + 1;
    const state: RoundState = { round, globalWeights: [...globalWeights], updates: [], completed: false };
    this.rounds.push(state);
    this.audit(round, 'round-start');
    return state;
  }

  /** FR-FL.2 업데이트 수집 */
  submitUpdate(update: ModelUpdate): void {
    const state = this.rounds.find((r) => r.round === update.round && !r.completed);
    if (!state) throw new Error('라운드 없음 또는 완료됨');
    if (!this.participants.get(update.participantId)?.active) throw new Error('비활성 참여자');
    state.updates.push(update);
    this.audit(update.round, `update-from-${update.participantId}`);
  }

  /** FR-FL.3 FedAvg 집계 */
  aggregateRound(round: number): number[] {
    const state = this.rounds.find((r) => r.round === round);
    if (!state) throw new Error('라운드 없음');
    if (state.updates.length === 0) return state.globalWeights;
    const totalSamples = state.updates.reduce((s, u) => s + u.sampleCount, 0);
    const dim = state.globalWeights.length;
    const agg = new Array(dim).fill(0);
    for (const u of state.updates) {
      const weight = u.sampleCount / totalSamples;
      for (let i = 0; i < dim; i++) agg[i] += (u.weights[i] ?? 0) * weight;
    }
    const rounded = agg.map((v) => +v.toFixed(6));
    const delta = this.l2Distance(state.globalWeights, rounded);
    state.globalWeights = rounded;
    state.completed = true;
    state.convergenceDelta = delta;
    this.audit(round, `aggregated-delta-${delta.toFixed(4)}`);
    return rounded;
  }

  /** FR-FL.4 수렴성 */
  getConvergence(): ConvergenceMetric[] {
    return this.rounds
      .filter((r) => r.completed)
      .map((r) => ({
        round: r.round,
        delta: r.convergenceDelta ?? 0,
        converged: (r.convergenceDelta ?? Infinity) < this.convergenceThreshold,
      }));
  }

  /** FR-FL.5 감사 로그 */
  getAuditLog(): Array<{ round: number; action: string; at: string }> {
    return [...this.auditLog];
  }

  private audit(round: number, action: string): void {
    this.auditLog.push({ round, action, at: new Date().toISOString() });
  }

  private l2Distance(a: number[], b: number[]): number {
    let sum = 0;
    for (let i = 0; i < a.length; i++) {
      const d = (a[i] ?? 0) - (b[i] ?? 0);
      sum += d * d;
    }
    return Math.sqrt(sum);
  }
}

export const federatedCoordinator = new FederatedCoordinator();
