// Design Ref: MTU-N466 §AI 윤리위원회
// Plan SC: FR-ETH.1~5

export type EthicsDecision = 'approved' | 'rejected' | 'conditional' | 'pending';

export interface Agenda {
  id: string;
  title: string;
  description: string;
  submittedAt: string;
  status: EthicsDecision;
  checklist: Array<{ principle: string; passed: boolean }>;
}

export interface Vote {
  agendaId: string;
  memberId: string;
  vote: 'yes' | 'no' | 'abstain';
  comment?: string;
  at: string;
}

export interface VoteTally {
  agendaId: string;
  yes: number;
  no: number;
  abstain: number;
  result: EthicsDecision;
}

export class AiEthicsCommittee {
  private agendas = new Map<string, Agenda>();
  private votes: Vote[] = [];

  /** FR-ETH.1 심의 안건 등록 */
  submitAgenda(id: string, title: string, description: string): Agenda {
    const agenda: Agenda = {
      id,
      title,
      description,
      submittedAt: new Date().toISOString(),
      status: 'pending',
      checklist: [],
    };
    this.agendas.set(id, agenda);
    return agenda;
  }

  /** FR-ETH.2 윤리 체크리스트 */
  runChecklist(agendaId: string, results: Array<{ principle: string; passed: boolean }>): Agenda {
    const a = this.agendas.get(agendaId);
    if (!a) throw new Error('안건 없음');
    a.checklist = results;
    return a;
  }

  /** FR-ETH.3 투표 집계 */
  castVote(vote: Omit<Vote, 'at'>): Vote {
    if (!this.agendas.get(vote.agendaId)) throw new Error('안건 없음');
    const full: Vote = { ...vote, at: new Date().toISOString() };
    this.votes.push(full);
    return full;
  }

  tallyVotes(agendaId: string): VoteTally {
    const agendaVotes = this.votes.filter((v) => v.agendaId === agendaId);
    const yes = agendaVotes.filter((v) => v.vote === 'yes').length;
    const no = agendaVotes.filter((v) => v.vote === 'no').length;
    const abstain = agendaVotes.filter((v) => v.vote === 'abstain').length;
    let result: EthicsDecision = 'pending';
    if (yes + no > 0) {
      if (yes > no) result = 'approved';
      else if (no > yes) result = 'rejected';
      else result = 'conditional';
    }
    const a = this.agendas.get(agendaId);
    if (a) a.status = result;
    return { agendaId, yes, no, abstain, result };
  }

  /** FR-ETH.4 결정 이력 */
  getHistory(): Agenda[] {
    return Array.from(this.agendas.values()).filter((a) => a.status !== 'pending');
  }

  /** FR-ETH.5 분기 리포트 */
  quarterlyReport(quarter: string): { quarter: string; total: number; approved: number; rejected: number } {
    const all = Array.from(this.agendas.values());
    const approved = all.filter((a) => a.status === 'approved').length;
    const rejected = all.filter((a) => a.status === 'rejected').length;
    return { quarter, total: all.length, approved, rejected };
  }
}

export const aiEthicsCommittee = new AiEthicsCommittee();
