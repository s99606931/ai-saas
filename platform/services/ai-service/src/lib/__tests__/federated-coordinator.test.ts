import { describe, it, expect, beforeEach } from 'vitest';
import { FederatedCoordinator } from '../federated-coordinator';

describe('FederatedCoordinator', () => {
  let svc: FederatedCoordinator;

  beforeEach(() => {
    svc = new FederatedCoordinator();
    svc.registerParticipant({ id: 'org1', name: '기관A', publicKey: 'pk1' });
    svc.registerParticipant({ id: 'org2', name: '기관B', publicKey: 'pk2' });
  });

  it('FR-FL.1 참여자 등록', () => {
    const p = svc.registerParticipant({ id: 'org3', name: '기관C', publicKey: 'pk3' });
    expect(p.active).toBe(true);
  });

  it('FR-FL.2 라운드 시작 + 업데이트 수집', () => {
    const state = svc.startRound([0.5, 0.5, 0.5]);
    svc.submitUpdate({ participantId: 'org1', round: state.round, weights: [0.6, 0.4, 0.5], sampleCount: 100 });
    svc.submitUpdate({ participantId: 'org2', round: state.round, weights: [0.4, 0.6, 0.5], sampleCount: 100 });
  });

  it('FR-FL.3 FedAvg 집계', () => {
    svc.startRound([0, 0]);
    svc.submitUpdate({ participantId: 'org1', round: 1, weights: [1, 1], sampleCount: 100 });
    svc.submitUpdate({ participantId: 'org2', round: 1, weights: [3, 3], sampleCount: 100 });
    const agg = svc.aggregateRound(1);
    expect(agg[0]).toBeCloseTo(2, 2);
    expect(agg[1]).toBeCloseTo(2, 2);
  });

  it('FR-FL.4 수렴성 추적', () => {
    svc.startRound([1, 1]);
    svc.submitUpdate({ participantId: 'org1', round: 1, weights: [1.0001, 1.0001], sampleCount: 100 });
    svc.aggregateRound(1);
    const conv = svc.getConvergence();
    expect(conv.length).toBe(1);
    expect(conv[0]!.converged).toBe(true);
  });

  it('FR-FL.5 감사 로그', () => {
    svc.startRound([0]);
    svc.submitUpdate({ participantId: 'org1', round: 1, weights: [0.5], sampleCount: 50 });
    svc.aggregateRound(1);
    const log = svc.getAuditLog();
    expect(log.length).toBeGreaterThanOrEqual(3);
  });
});
