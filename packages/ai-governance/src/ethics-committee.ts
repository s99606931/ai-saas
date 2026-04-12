/**
 * 공공 AI 윤리위원회 지원 시스템
 * Design Ref: MTU-N466 §3
 * Plan SC: FR-ETH.1~5
 */

export interface EthicsAgenda {
  agendaId: string;
  title: string;
  description: string;
  systemId: string;
  submittedAt: string;
  status: 'draft' | 'review' | 'voted' | 'closed';
}

export interface EthicsPrinciple {
  code: string;
  title: string;
  description: string;
}

export const CORE_PRINCIPLES: EthicsPrinciple[] = [
  { code: 'P-01', title: '인권 존중', description: '기본권·인간 존엄 침해 금지' },
  { code: 'P-02', title: '프라이버시 보호', description: '개인정보 최소 처리' },
  { code: 'P-03', title: '다양성 존중', description: '성별·연령·지역 편향 제거' },
  { code: 'P-04', title: '공공선', description: '사회적 공익 기여' },
  { code: 'P-05', title: '연대성', description: '공동체 이익' },
  { code: 'P-06', title: '데이터 관리', description: '적법·투명 처리' },
  { code: 'P-07', title: '책임성', description: '결과에 대한 책임 주체 명확' },
  { code: 'P-08', title: '안전성', description: '오작동·악용 방지' },
  { code: 'P-09', title: '투명성', description: '작동 원리 설명' },
  { code: 'P-10', title: '침해 금지', description: '인간에게 해를 끼치지 않음' },
];

/**
 * 윤리 심의 (FR-ETH.1~3)
 */
export interface Vote {
  memberId: string;
  decision: 'approve' | 'reject' | 'abstain';
  comment?: string;
  timestamp: string;
}

export class EthicsCommittee {
  private agendas = new Map<string, EthicsAgenda>();
  private votes = new Map<string, Vote[]>();
  private history: Array<{
    agendaId: string;
    result: 'approved' | 'rejected' | 'tied';
    closedAt: string;
  }> = [];

  submit(agenda: Omit<EthicsAgenda, 'submittedAt' | 'status'>): EthicsAgenda {
    const full: EthicsAgenda = {
      ...agenda,
      submittedAt: new Date().toISOString(),
      status: 'review',
    };
    this.agendas.set(full.agendaId, full);
    this.votes.set(full.agendaId, []);
    return full;
  }

  castVote(agendaId: string, vote: Omit<Vote, 'timestamp'>): void {
    const agenda = this.agendas.get(agendaId);
    if (!agenda) throw new Error(`안건 없음: ${agendaId}`);
    if (agenda.status !== 'review') throw new Error(`안건 상태가 review가 아님: ${agenda.status}`);
    const list = this.votes.get(agendaId) ?? [];
    // 중복 투표 방지
    const existing = list.find((v) => v.memberId === vote.memberId);
    if (existing) throw new Error(`중복 투표: ${vote.memberId}`);
    list.push({ ...vote, timestamp: new Date().toISOString() });
    this.votes.set(agendaId, list);
  }

  tally(agendaId: string): {
    approve: number;
    reject: number;
    abstain: number;
    result: 'approved' | 'rejected' | 'tied';
  } {
    const votes = this.votes.get(agendaId) ?? [];
    const approve = votes.filter((v) => v.decision === 'approve').length;
    const reject = votes.filter((v) => v.decision === 'reject').length;
    const abstain = votes.filter((v) => v.decision === 'abstain').length;
    let result: 'approved' | 'rejected' | 'tied' = 'tied';
    if (approve > reject) result = 'approved';
    else if (reject > approve) result = 'rejected';
    return { approve, reject, abstain, result };
  }

  close(agendaId: string): void {
    const agenda = this.agendas.get(agendaId);
    if (!agenda) throw new Error(`안건 없음: ${agendaId}`);
    const tally = this.tally(agendaId);
    agenda.status = 'closed';
    this.history.push({
      agendaId,
      result: tally.result,
      closedAt: new Date().toISOString(),
    });
  }

  /**
   * 분기 리포트 (FR-ETH.5)
   */
  quarterlyReport(quarter: string): {
    quarter: string;
    total: number;
    approved: number;
    rejected: number;
    tied: number;
  } {
    const relevant = this.history.filter((h) => h.closedAt.startsWith(quarter));
    return {
      quarter,
      total: relevant.length,
      approved: relevant.filter((h) => h.result === 'approved').length,
      rejected: relevant.filter((h) => h.result === 'rejected').length,
      tied: relevant.filter((h) => h.result === 'tied').length,
    };
  }
}
