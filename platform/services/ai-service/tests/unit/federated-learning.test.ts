// SVC-AI-ADV-R35 단위 테스트: 연합 학습 오케스트레이터
// Design Ref: SVC-AI-ADV-R35 DESIGN §1~§3, §5, §6
// Plan SC: FR-ADV35.1~35.3, FR-ADV35.5~35.6
// CSAP: D-09 데이터 보호, N2SF C등급 데이터 로컬 학습

import { describe, it, expect, beforeEach, afterEach } from 'vitest';

import {
  FederatedLearningOrchestrator,
  getFederatedLearning,
  resetFederatedLearning,
} from '../../src/lib/federated-learning.js';
import { resetDifferentialPrivacy } from '../../src/lib/differential-privacy.js';

// -- 참여자 관리 ---------------------------------------------------------------

describe('FederatedLearning 참여자 관리', () => {
  let fl: FederatedLearningOrchestrator;

  beforeEach(() => {
    resetDifferentialPrivacy();
    fl = new FederatedLearningOrchestrator({ parameterDimension: 8 });
  });

  it('참여자를 등록한다', () => {
    fl.registerParticipant('p1', 'tenant-1', 1000);
    expect(fl.getParticipantCount()).toBe(1);
  });

  it('여러 참여자를 등록한다', () => {
    fl.registerParticipant('p1', 'tenant-1', 1000);
    fl.registerParticipant('p2', 'tenant-2', 2000);
    fl.registerParticipant('p3', 'tenant-3', 500);
    expect(fl.getParticipantCount()).toBe(3);
  });

  it('참여자를 제거한다', () => {
    fl.registerParticipant('p1', 'tenant-1', 1000);
    fl.registerParticipant('p2', 'tenant-2', 2000);
    fl.removeParticipant('p1');
    expect(fl.getParticipantCount()).toBe(1);
  });
});

// -- 참여자 선택 -- Design §6 ---------------------------------------------------

describe('FederatedLearning 참여자 선택 (FR-ADV35.6)', () => {
  it('랜덤 선택 전략', () => {
    resetDifferentialPrivacy();
    const fl = new FederatedLearningOrchestrator({
      parameterDimension: 8,
      selectionStrategy: 'random',
      minParticipants: 2,
    });
    fl.registerParticipant('p1', 't1', 100);
    fl.registerParticipant('p2', 't2', 200);
    fl.registerParticipant('p3', 't3', 300);

    const selected = fl.selectParticipants(2);
    expect(selected).toHaveLength(2);
  });

  it('비례 선택 전략', () => {
    resetDifferentialPrivacy();
    const fl = new FederatedLearningOrchestrator({
      parameterDimension: 8,
      selectionStrategy: 'proportional',
      minParticipants: 2,
    });
    fl.registerParticipant('p1', 't1', 100);
    fl.registerParticipant('p2', 't2', 200);
    fl.registerParticipant('p3', 't3', 300);

    const selected = fl.selectParticipants(2);
    expect(selected).toHaveLength(2);
  });

  it('기여도 선택 전략', () => {
    resetDifferentialPrivacy();
    const fl = new FederatedLearningOrchestrator({
      parameterDimension: 8,
      selectionStrategy: 'contribution',
      minParticipants: 2,
    });
    fl.registerParticipant('p1', 't1', 100);
    fl.registerParticipant('p2', 't2', 200);
    fl.registerParticipant('p3', 't3', 300);

    const selected = fl.selectParticipants(2);
    expect(selected).toHaveLength(2);
  });

  it('사용 가능한 참여자 부족 시 전체 반환', () => {
    resetDifferentialPrivacy();
    const fl = new FederatedLearningOrchestrator({
      parameterDimension: 8,
      minParticipants: 5,
    });
    fl.registerParticipant('p1', 't1', 100);
    fl.registerParticipant('p2', 't2', 200);

    const selected = fl.selectParticipants(5);
    expect(selected).toHaveLength(2); // 2명만 가용
  });
});

// -- 라운드 실행 -- Design §1 ---------------------------------------------------

describe('FederatedLearning 라운드 실행 (FR-ADV35.1)', () => {
  it('참여자 부족 시 라운드 실패', async () => {
    resetDifferentialPrivacy();
    const fl = new FederatedLearningOrchestrator({
      parameterDimension: 8,
      minParticipants: 3,
    });
    fl.registerParticipant('p1', 't1', 100);

    const round = await fl.executeRound();
    expect(round.status).toBe('failed');
    expect(round.roundNumber).toBe(1);
  });

  it('충분한 참여자로 라운드를 완료한다', async () => {
    resetDifferentialPrivacy();
    const fl = new FederatedLearningOrchestrator({
      parameterDimension: 8,
      minParticipants: 3,
    });
    fl.registerParticipant('p1', 't1', 1000);
    fl.registerParticipant('p2', 't2', 2000);
    fl.registerParticipant('p3', 't3', 1500);

    const round = await fl.executeRound();
    expect(round.status).toBe('completed');
    expect(round.globalLoss).toBeDefined();
    expect(round.convergenceMetric).toBeDefined();
    expect(round.completedAt).toBeTruthy();
  });

  it('라운드 번호가 증가한다', async () => {
    resetDifferentialPrivacy();
    const fl = new FederatedLearningOrchestrator({
      parameterDimension: 8,
      minParticipants: 3,
    });
    fl.registerParticipant('p1', 't1', 1000);
    fl.registerParticipant('p2', 't2', 2000);
    fl.registerParticipant('p3', 't3', 1500);

    const r1 = await fl.executeRound();
    const r2 = await fl.executeRound();
    expect(r1.roundNumber).toBe(1);
    expect(r2.roundNumber).toBe(2);
  });

  it('참여자 상태가 라운드 후 idle로 복원된다', async () => {
    resetDifferentialPrivacy();
    const fl = new FederatedLearningOrchestrator({
      parameterDimension: 8,
      minParticipants: 3,
    });
    fl.registerParticipant('p1', 't1', 1000);
    fl.registerParticipant('p2', 't2', 2000);
    fl.registerParticipant('p3', 't3', 1500);

    const round = await fl.executeRound();
    // 완료 후 참여자가 idle 상태로 돌아가야 다음 라운드 참여 가능
    const nextRound = await fl.executeRound();
    expect(nextRound.status).toBe('completed');
  });
});

// -- 글로벌 모델 -- Design §5 ---------------------------------------------------

describe('FederatedLearning 글로벌 모델 (FR-ADV35.5)', () => {
  it('초기 모델을 생성한다', () => {
    resetDifferentialPrivacy();
    const fl = new FederatedLearningOrchestrator({ parameterDimension: 16 });
    const model = fl.getGlobalModel();
    expect(model.version).toBe(0);
    expect(model.parameters).toHaveLength(16);
    expect(model.totalRounds).toBe(0);
  });

  it('라운드 후 모델이 갱신된다', async () => {
    resetDifferentialPrivacy();
    const fl = new FederatedLearningOrchestrator({
      parameterDimension: 8,
      minParticipants: 3,
    });
    fl.registerParticipant('p1', 't1', 1000);
    fl.registerParticipant('p2', 't2', 2000);
    fl.registerParticipant('p3', 't3', 1500);

    const before = fl.getGlobalModel();
    await fl.executeRound();
    const after = fl.getGlobalModel();

    expect(after.version).toBe(before.version + 1);
    expect(after.totalRounds).toBe(1);
    expect(after.totalParticipants).toBe(3);
  });

  it('getGlobalModel은 방어 복사본을 반환한다', () => {
    resetDifferentialPrivacy();
    const fl = new FederatedLearningOrchestrator({ parameterDimension: 4 });
    const m1 = fl.getGlobalModel();
    const m2 = fl.getGlobalModel();
    expect(m1).not.toBe(m2);
    expect(m1.parameters).toEqual(m2.parameters);
  });
});

// -- 라운드 이력 ---------------------------------------------------------------

describe('FederatedLearning 라운드 이력', () => {
  it('실행된 라운드를 기록한다', async () => {
    resetDifferentialPrivacy();
    const fl = new FederatedLearningOrchestrator({
      parameterDimension: 8,
      minParticipants: 2,
    });
    fl.registerParticipant('p1', 't1', 1000);
    fl.registerParticipant('p2', 't2', 2000);

    await fl.executeRound();
    await fl.executeRound();

    const rounds = fl.getRounds();
    expect(rounds).toHaveLength(2);
  });
});

// -- 프라이버시 예산 -- DP 통합 -------------------------------------------------

describe('FederatedLearning 프라이버시 예산', () => {
  it('프라이버시 예산을 조회한다', () => {
    resetDifferentialPrivacy();
    const fl = new FederatedLearningOrchestrator({ parameterDimension: 8 });
    const budget = fl.getPrivacyBudget();
    expect(budget.totalEpsilon).toBeGreaterThan(0);
    expect(budget.queryCount).toBe(0);
  });

  it('라운드 후 프라이버시 예산이 소비된다', async () => {
    resetDifferentialPrivacy();
    const fl = new FederatedLearningOrchestrator({
      parameterDimension: 8,
      minParticipants: 3,
    });
    fl.registerParticipant('p1', 't1', 1000);
    fl.registerParticipant('p2', 't2', 2000);
    fl.registerParticipant('p3', 't3', 1500);

    const before = fl.getPrivacyBudget();
    await fl.executeRound();
    const after = fl.getPrivacyBudget();

    expect(after.queryCount).toBeGreaterThan(before.queryCount);
  });
});

// -- 전체 학습 (수렴) -----------------------------------------------------------

describe('FederatedLearning 전체 학습', () => {
  it('콜백과 함께 학습을 실행한다', async () => {
    resetDifferentialPrivacy();
    const fl = new FederatedLearningOrchestrator({
      parameterDimension: 4,
      minParticipants: 3,
      maxRounds: 3,
      convergenceThreshold: 0.0001, // 매우 작은 값이므로 3라운드 전부 실행
    });
    fl.registerParticipant('p1', 't1', 1000);
    fl.registerParticipant('p2', 't2', 2000);
    fl.registerParticipant('p3', 't3', 1500);

    const completedRounds: number[] = [];
    const model = await fl.train((round) => {
      completedRounds.push(round.roundNumber);
    });

    expect(completedRounds.length).toBeGreaterThan(0);
    expect(model.version).toBeGreaterThan(0);
    expect(model.parameters).toHaveLength(4);
  });

  it('참여자 부족 시 학습이 실패 라운드만 기록', async () => {
    resetDifferentialPrivacy();
    const fl = new FederatedLearningOrchestrator({
      parameterDimension: 4,
      minParticipants: 5,
      maxRounds: 2,
    });
    fl.registerParticipant('p1', 't1', 1000);

    const model = await fl.train();
    expect(model.totalRounds).toBe(0); // 성공 라운드 없음
    const rounds = fl.getRounds();
    expect(rounds.every((r) => r.status === 'failed')).toBe(true);
  });
});

// -- 팩토리 ------------------------------------------------------------------

describe('FederatedLearning 팩토리', () => {
  afterEach(() => {
    resetFederatedLearning();
    resetDifferentialPrivacy();
  });

  it('싱글턴 인스턴스를 반환한다', () => {
    const f1 = getFederatedLearning();
    const f2 = getFederatedLearning();
    expect(f1).toBe(f2);
  });

  it('리셋 후 새 인스턴스를 생성한다', () => {
    const f1 = getFederatedLearning();
    resetFederatedLearning();
    const f2 = getFederatedLearning();
    expect(f1).not.toBe(f2);
  });
});
