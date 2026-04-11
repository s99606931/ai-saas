// 연합 학습 오케스트레이터 -- FR-ADV35.1~35.3, FR-ADV35.5~35.6
// Design Ref: SVC-AI-ADV-R35 DESIGN §1~§3, §5, §6
// Plan SC: SC-1 (데이터 외부 유출 0), SC-3 (FedAvg 수렴)
// CSAP: D-09 데이터 보호, N2SF C등급 데이터 로컬 학습

import { DifferentialPrivacy, getDifferentialPrivacy, type PrivacyConfig } from './differential-privacy';

// -- 타입 정의 ────────────────────────────────────────────────────────────────

/** 연합 학습 참여자 */
export interface FederatedParticipant {
  id: string;
  tenantId: string;
  dataSize: number;
  status: 'idle' | 'training' | 'uploaded' | 'failed';
  localParameters?: number[];
  localLoss?: number;
  contribution?: number;
}

/** 연합 학습 라운드 -- Design §1 */
export interface FederatedRound {
  roundNumber: number;
  status: 'pending' | 'distributing' | 'training' | 'aggregating' | 'completed' | 'failed';
  participants: FederatedParticipant[];
  globalLoss?: number;
  startedAt?: string;
  completedAt?: string;
  convergenceMetric?: number;
}

/** 글로벌 모델 */
export interface GlobalModel {
  version: number;
  parameters: number[];
  lastUpdated: string;
  totalRounds: number;
  totalParticipants: number;
}

/** 로컬 학습 설정 -- Design §2 */
export interface LocalTrainingConfig {
  localEpochs: number;
  batchSize: number;
  learningRate: number;
}

/** 연합 학습 설정 */
export interface FederatedLearningConfig {
  /** 최소 참여자 수 */
  minParticipants: number;
  /** 최대 라운드 수 */
  maxRounds: number;
  /** 수렴 임계값 (글로벌 손실 변화) */
  convergenceThreshold: number;
  /** 로컬 학습 설정 */
  localTraining: LocalTrainingConfig;
  /** 차등 프라이버시 설정 */
  privacy?: Partial<PrivacyConfig>;
  /** 참여자 선택 전략 */
  selectionStrategy: 'random' | 'proportional' | 'contribution';
  /** 모델 파라미터 차원 */
  parameterDimension: number;
}

/** 참여자 선택 전략 */
export type SelectionStrategy = 'random' | 'proportional' | 'contribution';

// -- 기본 설정 ────────────────────────────────────────────────────────────────

const DEFAULT_CONFIG: FederatedLearningConfig = {
  minParticipants: 3,
  maxRounds: 100,
  convergenceThreshold: 0.001,
  localTraining: {
    localEpochs: 5,
    batchSize: 32,
    learningRate: 0.01,
  },
  selectionStrategy: 'proportional',
  parameterDimension: 128,
};

// -- 감사 로그 ────────────────────────────────────────────────────────────────

function auditLog(action: string, details: Record<string, unknown>): void {
  const entry = {
    timestamp: new Date().toISOString(),
    component: 'federated-learning',
    action,
    ...details,
  };
  console.log(`[AUDIT] ${JSON.stringify(entry)}`);
}

// -- FederatedLearningOrchestrator 메인 클래스 ────────────────────────────────

/** 연합 학습 오케스트레이터 -- Design §1 */
export class FederatedLearningOrchestrator {
  private readonly config: FederatedLearningConfig;
  private readonly dp: DifferentialPrivacy;
  private globalModel: GlobalModel;
  private participants: Map<string, FederatedParticipant> = new Map();
  private rounds: FederatedRound[] = [];
  private currentRound: number = 0;

  constructor(config?: Partial<FederatedLearningConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.dp = getDifferentialPrivacy(this.config.privacy);

    // 글로벌 모델 초기화 (랜덤 파라미터)
    this.globalModel = {
      version: 0,
      parameters: Array.from(
        { length: this.config.parameterDimension },
        () => (Math.random() - 0.5) * 0.01,
      ),
      lastUpdated: new Date().toISOString(),
      totalRounds: 0,
      totalParticipants: 0,
    };
  }

  // -- 참여자 관리 ────────────────────────────────────────────────────────

  /** 참여자 등록 */
  registerParticipant(id: string, tenantId: string, dataSize: number): void {
    this.participants.set(id, {
      id,
      tenantId,
      dataSize,
      status: 'idle',
    });

    auditLog('participant_registered', { participantId: id, tenantId, dataSize });
  }

  /** 참여자 제거 */
  removeParticipant(id: string): void {
    this.participants.delete(id);
  }

  /** 참여자 수 */
  getParticipantCount(): number {
    return this.participants.size;
  }

  // -- 참여자 선택 -- Design §6 ──────────────────────────────────────────

  /** 참여자 선택 -- Design §6 */
  selectParticipants(count: number): FederatedParticipant[] {
    const available = Array.from(this.participants.values()).filter(
      (p) => p.status === 'idle',
    );

    if (available.length < count) return available;

    switch (this.config.selectionStrategy) {
      case 'random':
        return this.randomSelect(available, count);
      case 'proportional':
        return this.proportionalSelect(available, count);
      case 'contribution':
        return this.contributionSelect(available, count);
      default:
        return this.randomSelect(available, count);
    }
  }

  private randomSelect(
    pool: FederatedParticipant[],
    count: number,
  ): FederatedParticipant[] {
    const shuffled = [...pool].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, count);
  }

  private proportionalSelect(
    pool: FederatedParticipant[],
    count: number,
  ): FederatedParticipant[] {
    // 데이터 크기 비례 확률 선택
    const totalData = pool.reduce((sum, p) => sum + p.dataSize, 0);
    const selected: FederatedParticipant[] = [];
    const remaining = [...pool];

    while (selected.length < count && remaining.length > 0) {
      const rand = Math.random() * totalData;
      let accumulated = 0;
      for (let i = 0; i < remaining.length; i++) {
        accumulated += remaining[i]!.dataSize;
        if (rand <= accumulated) {
          const spliced = remaining.splice(i, 1)[0];
          if (spliced) selected.push(spliced);
          break;
        }
      }
    }

    return selected;
  }

  private contributionSelect(
    pool: FederatedParticipant[],
    count: number,
  ): FederatedParticipant[] {
    // 기여도(낮은 손실) 순 정렬 + 상위 선택
    const sorted = [...pool].sort(
      (a, b) => (a.localLoss ?? Infinity) - (b.localLoss ?? Infinity),
    );
    return sorted.slice(0, count);
  }

  // -- 연합 학습 라운드 실행 -- Design §1 ────────────────────────────────

  /** 단일 라운드 실행 */
  async executeRound(): Promise<FederatedRound> {
    this.currentRound += 1;

    const round: FederatedRound = {
      roundNumber: this.currentRound,
      status: 'pending',
      participants: [],
      startedAt: new Date().toISOString(),
    };

    // 1. 참여자 선택
    const selected = this.selectParticipants(this.config.minParticipants);
    if (selected.length < this.config.minParticipants) {
      round.status = 'failed';
      auditLog('round_failed', {
        round: this.currentRound,
        reason: `참여자 부족: ${selected.length} < ${this.config.minParticipants}`,
      });
      this.rounds.push(round);
      return round;
    }

    round.participants = selected;
    round.status = 'distributing';

    // 2. 글로벌 모델 배포
    for (const participant of selected) {
      participant.status = 'training';
    }

    round.status = 'training';

    // 3. 로컬 학습 시뮬레이션
    for (const participant of selected) {
      const localResult = this.simulateLocalTraining(participant);
      participant.localParameters = localResult.parameters;
      participant.localLoss = localResult.loss;
      participant.status = 'uploaded';
    }

    round.status = 'aggregating';

    // 4. DP 노이즈 적용 + 집계
    const updatedParams = this.aggregateParameters(selected);

    // 5. 글로벌 모델 갱신
    const previousLoss = this.globalModel.totalRounds > 0
      ? this.calculateGlobalLoss(selected)
      : Infinity;

    this.globalModel.parameters = updatedParams;
    this.globalModel.version += 1;
    this.globalModel.lastUpdated = new Date().toISOString();
    this.globalModel.totalRounds += 1;
    this.globalModel.totalParticipants += selected.length;

    // 6. 수렴 검사
    const currentLoss = this.calculateGlobalLoss(selected);
    round.globalLoss = currentLoss;
    round.convergenceMetric = Math.abs(previousLoss - currentLoss);
    round.status = 'completed';
    round.completedAt = new Date().toISOString();

    // 참여자 상태 초기화
    for (const participant of selected) {
      participant.status = 'idle';
    }

    this.rounds.push(round);

    auditLog('round_completed', {
      round: this.currentRound,
      participants: selected.length,
      globalLoss: currentLoss,
      convergence: round.convergenceMetric,
    });

    return round;
  }

  // -- 로컬 학습 시뮬레이션 -- Design §2 ────────────────────────────────

  /** 로컬 학습 시뮬레이션 (실제 구현에서는 테넌트 로컬 실행) */
  private simulateLocalTraining(
    participant: FederatedParticipant,
  ): { parameters: number[]; loss: number } {
    const lr = this.config.localTraining.learningRate;
    const params = [...this.globalModel.parameters];

    // 시뮬레이션: 로컬 데이터 기반 SGD
    for (let epoch = 0; epoch < this.config.localTraining.localEpochs; epoch++) {
      for (let i = 0; i < params.length; i++) {
        // 의사 그래디언트 (실제에서는 로컬 데이터 기반 계산)
        const gradient = (Math.random() - 0.5) * 0.01 * (participant.dataSize / 1000);
        params[i] = (params[i] ?? 0) - lr * gradient;
      }
    }

    // 손실 시뮬레이션
    const loss = 0.5 + Math.random() * 0.5 * (1 / Math.sqrt(participant.dataSize));

    return { parameters: params, loss };
  }

  // -- 파라미터 집계 -- Design §3 ────────────────────────────────────────

  /** FedAvg 파라미터 집계 -- Design §3 */
  private aggregateParameters(participants: FederatedParticipant[]): number[] {
    const totalData = participants.reduce((sum, p) => sum + p.dataSize, 0);
    const dimension = this.config.parameterDimension;
    const aggregated = new Array(dimension).fill(0) as number[];

    for (const participant of participants) {
      if (!participant.localParameters) continue;

      const weight = participant.dataSize / totalData;

      // DP 노이즈 적용
      const noisyParams = this.dp.addNoiseToGradients(participant.localParameters);

      for (let i = 0; i < dimension; i++) {
        aggregated[i] = (aggregated[i] ?? 0) + (noisyParams[i] ?? 0) * weight;
      }

      participant.contribution = weight;
    }

    return aggregated;
  }

  // -- 글로벌 손실 계산 ──────────────────────────────────────────────────

  private calculateGlobalLoss(participants: FederatedParticipant[]): number {
    const losses = participants
      .filter((p) => p.localLoss !== undefined)
      .map((p) => p.localLoss!);

    if (losses.length === 0) return Infinity;
    return losses.reduce((sum, l) => sum + l, 0) / losses.length;
  }

  // -- 전체 학습 루프 ────────────────────────────────────────────────────

  /** 전체 연합 학습 실행 (수렴까지) */
  async train(
    onRoundComplete?: (round: FederatedRound) => void,
  ): Promise<GlobalModel> {
    auditLog('training_started', {
      maxRounds: this.config.maxRounds,
      minParticipants: this.config.minParticipants,
    });

    for (let r = 0; r < this.config.maxRounds; r++) {
      const round = await this.executeRound();

      if (onRoundComplete) onRoundComplete(round);

      if (round.status === 'completed' &&
          round.convergenceMetric !== undefined &&
          round.convergenceMetric < this.config.convergenceThreshold) {
        auditLog('training_converged', {
          round: round.roundNumber,
          convergence: round.convergenceMetric,
        });
        break;
      }
    }

    return this.getGlobalModel();
  }

  // -- 모델 배포 -- Design §5 ────────────────────────────────────────────

  /** 글로벌 모델 조회 */
  getGlobalModel(): GlobalModel {
    return { ...this.globalModel };
  }

  /** 라운드 이력 조회 */
  getRounds(): FederatedRound[] {
    return [...this.rounds];
  }

  /** 프라이버시 예산 조회 */
  getPrivacyBudget() {
    return this.dp.getBudget();
  }
}

// -- 팩토리 ──────────────────────────────────────────────────────────────────

let orchestratorInstance: FederatedLearningOrchestrator | null = null;

export function getFederatedLearning(
  config?: Partial<FederatedLearningConfig>,
): FederatedLearningOrchestrator {
  if (!orchestratorInstance) {
    orchestratorInstance = new FederatedLearningOrchestrator(config);
  }
  return orchestratorInstance;
}

export function resetFederatedLearning(): void {
  orchestratorInstance = null;
}
