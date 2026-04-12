// Design Ref: MTU-N459 §coordinator
// Plan SC: FR-FL.1 ~ FR-FL.5
//
// 연합학습 코디네이터 (FedAvg). 참여 기관 등록 + 라운드 관리 + 수렴성 모니터링 +
// 감사 로그. 순수 수치 연산이며 외부 AI API 호출 없음.
// 원시 학습 데이터는 기관 내부에 머무르고, 모델 가중치만 집계 (연합학습 원칙).

export interface Participant {
  id: string;
  name: string;
  publicKey: string;
  sampleCount: number;
  registeredAt: string;
  active: boolean;
}

export interface ModelUpdate {
  participantId: string;
  round: number;
  weights: number[]; // 단순화: 1D 가중치 벡터
  sampleCount: number;
  submittedAt: string;
}

export interface GlobalModel {
  round: number;
  weights: number[];
  aggregatedAt: string;
  participantsCount: number;
}

export interface RoundSummary {
  round: number;
  globalLoss: number;
  deltaFromPrev: number;
  converged: boolean;
  participants: string[];
}

export interface RoundAuditEntry {
  id: string;
  round: number;
  event: 'started' | 'update_received' | 'aggregated' | 'converged';
  at: string;
  actor: string;
  detail?: string;
}

// FR-FL.1: 참여 기관 등록 + 인증 (공개키 기반)
export class ParticipantRegistry {
  private participants: Map<string, Participant> = new Map();

  register(p: Omit<Participant, 'registeredAt' | 'active'>): Participant {
    if (this.participants.has(p.id)) {
      throw new Error(`Participant already registered: ${p.id}`);
    }
    const full: Participant = {
      ...p,
      registeredAt: new Date().toISOString(),
      active: true,
    };
    this.participants.set(p.id, full);
    return { ...full };
  }

  deactivate(id: string): void {
    const p = this.participants.get(id);
    if (!p) throw new Error(`Unknown participant: ${id}`);
    p.active = false;
  }

  get(id: string): Participant | undefined {
    const p = this.participants.get(id);
    return p ? { ...p } : undefined;
  }

  listActive(): Participant[] {
    return Array.from(this.participants.values()).filter((p) => p.active);
  }

  verify(id: string, publicKey: string): boolean {
    const p = this.participants.get(id);
    return p !== undefined && p.active && p.publicKey === publicKey;
  }
}

// FR-FL.3: FedAvg 집계 알고리즘 (샘플 가중 평균)
export function fedAvgAggregate(updates: ModelUpdate[]): number[] {
  if (updates.length === 0) {
    throw new Error('No updates to aggregate');
  }
  const dim = updates[0].weights.length;
  for (const u of updates) {
    if (u.weights.length !== dim) {
      throw new Error(`Weight dim mismatch: ${u.participantId}`);
    }
  }
  const totalSamples = updates.reduce((s, u) => s + u.sampleCount, 0);
  if (totalSamples === 0) {
    throw new Error('Total sample count is zero');
  }
  const agg = new Array<number>(dim).fill(0);
  for (const u of updates) {
    const weight = u.sampleCount / totalSamples;
    for (let i = 0; i < dim; i++) {
      agg[i] += u.weights[i] * weight;
    }
  }
  return agg.map((v) => round6(v));
}

// FR-FL.2, FR-FL.4, FR-FL.5: 라운드 관리자 + 수렴성 모니터링 + 감사
export class FederatedCoordinator {
  private currentRound = 0;
  private global: GlobalModel | null = null;
  private roundUpdates: Map<number, ModelUpdate[]> = new Map();
  private audit: RoundAuditEntry[] = [];
  private nextAuditId = 1;
  private convergenceThreshold: number;

  constructor(
    private registry: ParticipantRegistry,
    options: { convergenceThreshold?: number } = {},
  ) {
    this.convergenceThreshold = options.convergenceThreshold ?? 0.001;
  }

  startRound(initialWeights: number[], actor: string): number {
    this.currentRound += 1;
    this.roundUpdates.set(this.currentRound, []);
    if (this.global === null) {
      this.global = {
        round: 0,
        weights: initialWeights.slice(),
        aggregatedAt: new Date().toISOString(),
        participantsCount: 0,
      };
    }
    this.logAudit(this.currentRound, 'started', actor);
    return this.currentRound;
  }

  submitUpdate(update: ModelUpdate): void {
    if (update.round !== this.currentRound) {
      throw new Error(`Round mismatch: expected ${this.currentRound}, got ${update.round}`);
    }
    if (!this.registry.listActive().some((p) => p.id === update.participantId)) {
      throw new Error(`Unknown/inactive participant: ${update.participantId}`);
    }
    this.roundUpdates.get(this.currentRound)!.push(update);
    this.logAudit(
      this.currentRound,
      'update_received',
      update.participantId,
      `samples=${update.sampleCount}`,
    );
  }

  aggregate(actor: string): RoundSummary {
    const updates = this.roundUpdates.get(this.currentRound) ?? [];
    if (updates.length === 0) {
      throw new Error(`No updates for round ${this.currentRound}`);
    }
    const newWeights = fedAvgAggregate(updates);
    const prevWeights = this.global!.weights;
    const delta = l2Distance(newWeights, prevWeights);
    this.global = {
      round: this.currentRound,
      weights: newWeights,
      aggregatedAt: new Date().toISOString(),
      participantsCount: updates.length,
    };
    const globalLoss = computePseudoLoss(newWeights);
    const converged = delta < this.convergenceThreshold;
    this.logAudit(
      this.currentRound,
      'aggregated',
      actor,
      `delta=${delta.toFixed(6)} loss=${globalLoss.toFixed(6)}`,
    );
    if (converged) {
      this.logAudit(this.currentRound, 'converged', actor);
    }
    return {
      round: this.currentRound,
      globalLoss: round6(globalLoss),
      deltaFromPrev: round6(delta),
      converged,
      participants: updates.map((u) => u.participantId),
    };
  }

  getGlobalModel(): GlobalModel | null {
    return this.global ? { ...this.global, weights: [...this.global.weights] } : null;
  }

  auditLog(): RoundAuditEntry[] {
    return this.audit.map((e) => ({ ...e }));
  }

  private logAudit(
    round: number,
    event: RoundAuditEntry['event'],
    actor: string,
    detail?: string,
  ): void {
    const entry: RoundAuditEntry = {
      id: `fl-audit-${this.nextAuditId++}`,
      round,
      event,
      at: new Date().toISOString(),
      actor,
      detail,
    };
    Object.freeze(entry);
    this.audit.push(entry);
  }
}

// ==== 유틸 ====
function l2Distance(a: number[], b: number[]): number {
  if (a.length !== b.length) return Infinity;
  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    const d = a[i] - b[i];
    sum += d * d;
  }
  return Math.sqrt(sum);
}

function computePseudoLoss(weights: number[]): number {
  // 실제 손실 함수는 외부 평가셋 필요 — 내부 지표로 L2 norm 사용
  const sum = weights.reduce((s, w) => s + w * w, 0);
  return Math.sqrt(sum) / Math.max(1, weights.length);
}

function round6(n: number): number {
  return Math.round(n * 1_000_000) / 1_000_000;
}
