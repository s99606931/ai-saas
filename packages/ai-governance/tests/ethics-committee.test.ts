/**
 * AI 윤리위원회 테스트
 * Plan SC: FR-ETH.1~5
 */

import { EthicsCommittee, CORE_PRINCIPLES } from '../src/ethics-committee';

describe('CORE_PRINCIPLES', () => {
  it('10대 윤리 원칙 정의', () => {
    expect(CORE_PRINCIPLES.length).toBe(10);
    const codes = CORE_PRINCIPLES.map((p) => p.code);
    expect(codes).toContain('P-01');
    expect(codes).toContain('P-10');
  });
});

describe('EthicsCommittee', () => {
  let c: EthicsCommittee;
  beforeEach(() => {
    c = new EthicsCommittee();
  });

  it('submit + tally + close', () => {
    c.submit({ agendaId: 'a1', title: '제목', description: '설명', systemId: 's1' });
    c.castVote('a1', { memberId: 'm1', decision: 'approve' });
    c.castVote('a1', { memberId: 'm2', decision: 'approve' });
    c.castVote('a1', { memberId: 'm3', decision: 'reject' });
    const tally = c.tally('a1');
    expect(tally.approve).toBe(2);
    expect(tally.reject).toBe(1);
    expect(tally.result).toBe('approved');
    c.close('a1');
  });

  it('castVote: 미존재 안건 시 오류', () => {
    expect(() => c.castVote('x', { memberId: 'm', decision: 'approve' })).toThrow(
      /안건 없음/,
    );
  });

  it('castVote: 중복 투표 차단', () => {
    c.submit({ agendaId: 'a1', title: 't', description: 'd', systemId: 's1' });
    c.castVote('a1', { memberId: 'm1', decision: 'approve' });
    expect(() => c.castVote('a1', { memberId: 'm1', decision: 'reject' })).toThrow(
      /중복 투표/,
    );
  });

  it('tally: 동수 → tied', () => {
    c.submit({ agendaId: 'a1', title: 't', description: 'd', systemId: 's1' });
    c.castVote('a1', { memberId: 'm1', decision: 'approve' });
    c.castVote('a1', { memberId: 'm2', decision: 'reject' });
    expect(c.tally('a1').result).toBe('tied');
  });

  it('quarterlyReport: 분기 통계', () => {
    c.submit({ agendaId: 'a1', title: 't', description: 'd', systemId: 's1' });
    c.castVote('a1', { memberId: 'm1', decision: 'approve' });
    c.close('a1');
    const q = `${new Date().getFullYear()}-Q${Math.floor(new Date().getMonth() / 3) + 1}`;
    // 전체 분기 표기: ISO 시작 (예: 2026)
    const year = new Date().toISOString().slice(0, 4);
    const report = c.quarterlyReport(year);
    expect(report.total).toBeGreaterThanOrEqual(1);
    expect(report.approved).toBeGreaterThanOrEqual(1);
  });

  it('close: 미존재 안건 시 오류', () => {
    expect(() => c.close('nope')).toThrow(/안건 없음/);
  });

  it('castVote: review 상태 아닌 안건은 거부', () => {
    c.submit({ agendaId: 'a1', title: 't', description: 'd', systemId: 's1' });
    c.castVote('a1', { memberId: 'm1', decision: 'approve' });
    c.close('a1');
    expect(() => c.castVote('a1', { memberId: 'm2', decision: 'approve' })).toThrow(
      /review/,
    );
  });
});
