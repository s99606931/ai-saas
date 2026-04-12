// Test Ref: MTU-N466 §ethics-committee
import { describe, it, expect } from 'vitest';
import { EthicsCommittee, listEthicsPrinciples } from '../src/index.js';

describe('listEthicsPrinciples — FR-ETH.2', () => {
  it('7가지 원칙', () => {
    expect(listEthicsPrinciples().length).toBe(7);
  });
});

describe('EthicsCommittee — FR-ETH.1/3/4', () => {
  it('안건 제출 → 투표 → 승인 결정', () => {
    const c = new EthicsCommittee(5, 0.6); // 정족수 3
    const ag = c.submit({
      title: '채용 AI 도입',
      category: 'bias',
      submittedBy: 'pm',
      description: '서류 심사 AI',
    });
    expect(ag.status).toBe('submitted');
    c.markReviewing(ag.id);
    c.recordVote(ag.id, { memberId: 'm1', vote: 'approve' });
    c.recordVote(ag.id, { memberId: 'm2', vote: 'approve' });
    c.recordVote(ag.id, { memberId: 'm3', vote: 'approve' });
    const tally = c.tally(ag.id);
    expect(tally.approve).toBe(3);
    expect(tally.quorumReached).toBe(true);
    expect(tally.decision).toBe('approve');
    // 결정 후 finalized
    const history = c.listHistory();
    expect(history[0].status).toBe('finalized');
    expect(history[0].decision).toBe('approve');
  });

  it('정족수 미달 시 conditional', () => {
    const c = new EthicsCommittee(10, 0.6);
    const ag = c.submit({
      title: 'x',
      category: 'privacy',
      submittedBy: 'p',
      description: '',
    });
    c.recordVote(ag.id, { memberId: 'm1', vote: 'approve' });
    const tally = c.tally(ag.id);
    expect(tally.quorumReached).toBe(false);
    expect(tally.decision).toBe('conditional');
  });

  it('중복 투표 거부', () => {
    const c = new EthicsCommittee(5);
    const ag = c.submit({
      title: 'x',
      category: 'safety',
      submittedBy: 'p',
      description: '',
    });
    c.recordVote(ag.id, { memberId: 'm1', vote: 'approve' });
    expect(() => c.recordVote(ag.id, { memberId: 'm1', vote: 'reject' })).toThrow();
  });
});

describe('EthicsCommittee.quarterReport — FR-ETH.5', () => {
  it('분기 리포트 집계', () => {
    const c = new EthicsCommittee(3, 0.5);
    const ag = c.submit({
      title: 'x',
      category: 'privacy',
      submittedBy: 'p',
      description: '',
    });
    c.recordVote(ag.id, { memberId: 'm1', vote: 'approve' });
    c.recordVote(ag.id, { memberId: 'm2', vote: 'approve' });
    c.tally(ag.id);
    const now = new Date();
    const report = c.quarterReport(
      now.getUTCFullYear(),
      (Math.floor(now.getUTCMonth() / 3) + 1) as 1 | 2 | 3 | 4,
    );
    expect(report.total).toBe(1);
    expect(report.byCategory.privacy).toBe(1);
    expect(report.approveRate).toBe(1);
  });
});
