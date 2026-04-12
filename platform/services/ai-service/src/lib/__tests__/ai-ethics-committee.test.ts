import { describe, it, expect, beforeEach } from 'vitest';
import { AiEthicsCommittee } from '../ai-ethics-committee';

describe('AiEthicsCommittee', () => {
  let svc: AiEthicsCommittee;

  beforeEach(() => {
    svc = new AiEthicsCommittee();
    svc.submitAgenda('a1', '민원 AI 도입', '자동 분류 시스템');
  });

  it('FR-ETH.1 안건 등록', () => {
    const a = svc.submitAgenda('a2', '얼굴 인식', 'CCTV 보강');
    expect(a.status).toBe('pending');
  });

  it('FR-ETH.2 체크리스트', () => {
    const a = svc.runChecklist('a1', [
      { principle: '투명성', passed: true },
      { principle: '공정성', passed: true },
    ]);
    expect(a.checklist.length).toBe(2);
  });

  it('FR-ETH.3 투표 집계 (승인)', () => {
    svc.castVote({ agendaId: 'a1', memberId: 'm1', vote: 'yes' });
    svc.castVote({ agendaId: 'a1', memberId: 'm2', vote: 'yes' });
    svc.castVote({ agendaId: 'a1', memberId: 'm3', vote: 'no' });
    const tally = svc.tallyVotes('a1');
    expect(tally.result).toBe('approved');
  });

  it('FR-ETH.4 이력', () => {
    svc.castVote({ agendaId: 'a1', memberId: 'm1', vote: 'yes' });
    svc.tallyVotes('a1');
    expect(svc.getHistory().length).toBe(1);
  });

  it('FR-ETH.5 분기 리포트', () => {
    svc.castVote({ agendaId: 'a1', memberId: 'm1', vote: 'yes' });
    svc.tallyVotes('a1');
    const r = svc.quarterlyReport('2026-Q2');
    expect(r.total).toBe(1);
    expect(r.approved).toBe(1);
  });
});
