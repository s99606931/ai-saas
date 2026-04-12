// Test Ref: MTU-N459 §coordinator
import { describe, it, expect } from 'vitest';
import {
  ParticipantRegistry,
  FederatedCoordinator,
  fedAvgAggregate,
  type ModelUpdate,
} from '../src/index.js';

describe('ParticipantRegistry — FR-FL.1', () => {
  it('등록 + 공개키 검증', () => {
    const reg = new ParticipantRegistry();
    reg.register({
      id: 'org1',
      name: 'Org 1',
      publicKey: 'pk1',
      sampleCount: 100,
    });
    expect(reg.verify('org1', 'pk1')).toBe(true);
    expect(reg.verify('org1', 'wrong')).toBe(false);
    expect(reg.verify('unknown', 'pk1')).toBe(false);
  });

  it('중복 등록 차단 + 비활성화', () => {
    const reg = new ParticipantRegistry();
    reg.register({ id: 'a', name: 'A', publicKey: 'k', sampleCount: 1 });
    expect(() => reg.register({ id: 'a', name: 'A2', publicKey: 'k2', sampleCount: 2 })).toThrow();
    reg.deactivate('a');
    expect(reg.listActive().length).toBe(0);
  });
});

describe('fedAvgAggregate — FR-FL.3', () => {
  it('샘플 가중 평균', () => {
    const updates: ModelUpdate[] = [
      {
        participantId: 'a',
        round: 1,
        weights: [1, 0],
        sampleCount: 100,
        submittedAt: '',
      },
      {
        participantId: 'b',
        round: 1,
        weights: [0, 1],
        sampleCount: 300,
        submittedAt: '',
      },
    ];
    const agg = fedAvgAggregate(updates);
    expect(agg[0]).toBeCloseTo(0.25, 6);
    expect(agg[1]).toBeCloseTo(0.75, 6);
  });

  it('차원 불일치 에러', () => {
    const updates: ModelUpdate[] = [
      { participantId: 'a', round: 1, weights: [1, 2], sampleCount: 10, submittedAt: '' },
      { participantId: 'b', round: 1, weights: [1], sampleCount: 10, submittedAt: '' },
    ];
    expect(() => fedAvgAggregate(updates)).toThrow();
  });
});

describe('FederatedCoordinator — FR-FL.2/4/5', () => {
  it('라운드 실행 + 집계 + 감사', () => {
    const reg = new ParticipantRegistry();
    reg.register({ id: 'a', name: 'A', publicKey: 'ka', sampleCount: 100 });
    reg.register({ id: 'b', name: 'B', publicKey: 'kb', sampleCount: 100 });
    const coord = new FederatedCoordinator(reg, { convergenceThreshold: 0.0001 });
    const round = coord.startRound([0, 0], 'pm');
    coord.submitUpdate({
      participantId: 'a',
      round,
      weights: [0.5, 0.5],
      sampleCount: 100,
      submittedAt: new Date().toISOString(),
    });
    coord.submitUpdate({
      participantId: 'b',
      round,
      weights: [0.7, 0.3],
      sampleCount: 100,
      submittedAt: new Date().toISOString(),
    });
    const summary = coord.aggregate('pm');
    expect(summary.round).toBe(1);
    expect(summary.participants).toEqual(['a', 'b']);
    expect(summary.converged).toBe(false);
    expect(coord.getGlobalModel()?.weights.length).toBe(2);
    const auditEvents = coord.auditLog().map((e) => e.event);
    expect(auditEvents).toContain('started');
    expect(auditEvents).toContain('update_received');
    expect(auditEvents).toContain('aggregated');
  });

  it('수렴 감지', () => {
    const reg = new ParticipantRegistry();
    reg.register({ id: 'a', name: 'A', publicKey: 'k', sampleCount: 10 });
    const coord = new FederatedCoordinator(reg, { convergenceThreshold: 1 });
    coord.startRound([0, 0], 'pm');
    coord.submitUpdate({
      participantId: 'a',
      round: 1,
      weights: [0.0001, 0.0001],
      sampleCount: 10,
      submittedAt: '',
    });
    const s = coord.aggregate('pm');
    expect(s.converged).toBe(true);
  });

  it('미등록 참여자 업데이트 거부', () => {
    const reg = new ParticipantRegistry();
    const coord = new FederatedCoordinator(reg);
    coord.startRound([0], 'pm');
    expect(() =>
      coord.submitUpdate({
        participantId: 'ghost',
        round: 1,
        weights: [1],
        sampleCount: 1,
        submittedAt: '',
      }),
    ).toThrow();
  });
});
