/**
 * 연합학습 조정자 테스트
 * Plan SC: FR-FL.1~5
 */

import {
  FederatedCoordinator,
  FedAvgAggregator,
  Participant,
  ModelUpdate,
} from '../src/federated-coordinator';

const sampleParticipant = (id: string): Participant => ({
  participantId: id,
  organization: `Org-${id}`,
  publicKey: 'pk-1234567890abcdef',
  datasetSize: 1000,
  joinedAt: '2026-04-12',
});

describe('FedAvgAggregator', () => {
  const agg = new FedAvgAggregator();

  it('가중 평균: 샘플 수에 비례', () => {
    const result = agg.aggregate([
      { participantId: 'p1', round: 1, weights: [1, 2, 3], sampleCount: 100, submittedAt: '' },
      { participantId: 'p2', round: 1, weights: [3, 4, 5], sampleCount: 100, submittedAt: '' },
    ]);
    expect(result).toEqual([2, 3, 4]);
  });

  it('샘플 수 다른 경우 가중치 다름', () => {
    const result = agg.aggregate([
      { participantId: 'p1', round: 1, weights: [10, 0], sampleCount: 900, submittedAt: '' },
      { participantId: 'p2', round: 1, weights: [0, 10], sampleCount: 100, submittedAt: '' },
    ]);
    expect(result[0]).toBeCloseTo(9);
    expect(result[1]).toBeCloseTo(1);
  });

  it('빈 입력 시 오류', () => {
    expect(() => agg.aggregate([])).toThrow(/집계할 업데이트/);
  });

  it('차원 0 시 오류', () => {
    expect(() =>
      agg.aggregate([
        { participantId: 'p1', round: 1, weights: [], sampleCount: 100, submittedAt: '' },
      ]),
    ).toThrow(/가중치 차원/);
  });

  it('차원 불일치 시 오류', () => {
    expect(() =>
      agg.aggregate([
        { participantId: 'p1', round: 1, weights: [1, 2], sampleCount: 50, submittedAt: '' },
        { participantId: 'p2', round: 1, weights: [1, 2, 3], sampleCount: 50, submittedAt: '' },
      ]),
    ).toThrow(/차원 불일치/);
  });

  it('총 샘플 수 0이면 오류', () => {
    expect(() =>
      agg.aggregate([
        { participantId: 'p1', round: 1, weights: [1, 2], sampleCount: 0, submittedAt: '' },
      ]),
    ).toThrow(/샘플 수가 0/);
  });
});

describe('FederatedCoordinator', () => {
  let coord: FederatedCoordinator;
  beforeEach(() => {
    coord = new FederatedCoordinator();
  });

  it('참여자 등록 + 초기화 + 라운드 종료', () => {
    coord.registerParticipant(sampleParticipant('p1'));
    coord.registerParticipant(sampleParticipant('p2'));
    coord.initializeModel([0, 0, 0]);

    const update1: ModelUpdate = {
      participantId: 'p1',
      round: 0,
      weights: [1, 1, 1],
      sampleCount: 100,
      submittedAt: '',
    };
    const update2: ModelUpdate = {
      participantId: 'p2',
      round: 0,
      weights: [3, 3, 3],
      sampleCount: 100,
      submittedAt: '',
    };
    coord.submitUpdate(update1);
    coord.submitUpdate(update2);

    const next = coord.finalizeRound(0);
    expect(next.round).toBe(1);
    expect(next.weights).toEqual([2, 2, 2]);
  });

  it('미등록 참여자 업데이트 거부', () => {
    expect(() =>
      coord.submitUpdate({
        participantId: 'unknown',
        round: 0,
        weights: [1],
        sampleCount: 1,
        submittedAt: '',
      }),
    ).toThrow(/미등록 참여자/);
  });

  it('최소 참여자 미달 시 오류', () => {
    coord.registerParticipant(sampleParticipant('p1'));
    coord.initializeModel([0]);
    coord.submitUpdate({
      participantId: 'p1',
      round: 0,
      weights: [1],
      sampleCount: 1,
      submittedAt: '',
    });
    expect(() => coord.finalizeRound(0, 2)).toThrow(/최소 참여자/);
  });

  it('checkConvergence: 라운드 1개 이하면 미수렴', () => {
    coord.initializeModel([1, 2, 3]);
    expect(coord.checkConvergence().converged).toBe(false);
  });

  it('checkConvergence: 동일 가중치 이어지면 수렴', () => {
    coord.registerParticipant(sampleParticipant('p1'));
    coord.registerParticipant(sampleParticipant('p2'));
    coord.initializeModel([1, 1, 1]);
    coord.submitUpdate({
      participantId: 'p1',
      round: 0,
      weights: [1, 1, 1],
      sampleCount: 100,
      submittedAt: '',
    });
    coord.submitUpdate({
      participantId: 'p2',
      round: 0,
      weights: [1, 1, 1],
      sampleCount: 100,
      submittedAt: '',
    });
    coord.finalizeRound(0);
    const conv = coord.checkConvergence();
    expect(conv.converged).toBe(true);
    expect(conv.distance).toBe(0);
  });

  it('contributionReport: 참여자별 업데이트 횟수 집계', () => {
    coord.registerParticipant(sampleParticipant('p1'));
    coord.registerParticipant(sampleParticipant('p2'));
    coord.initializeModel([0]);
    coord.submitUpdate({
      participantId: 'p1',
      round: 0,
      weights: [1],
      sampleCount: 1,
      submittedAt: '',
    });
    coord.submitUpdate({
      participantId: 'p1',
      round: 0,
      weights: [2],
      sampleCount: 1,
      submittedAt: '',
    });
    const report = coord.contributionReport();
    expect(report.find((r) => r.participantId === 'p1')?.contributions).toBe(2);
  });

  it('getLatestModel 반환', () => {
    coord.initializeModel([1, 2, 3]);
    expect(coord.getLatestModel()?.round).toBe(0);
  });

  it('zod: 잘못된 publicKey', () => {
    expect(() =>
      coord.registerParticipant({ ...sampleParticipant('p1'), publicKey: 'short' }),
    ).toThrow();
  });
});
