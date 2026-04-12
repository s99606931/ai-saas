// Design Ref: MTU-N466 §ethics-committee
// Plan SC: FR-ETH.1 ~ FR-ETH.5
//
// AI 윤리위원회 심의 안건 관리 + 투표 집계 + 결정 이력 + 분기 리포트.

export interface EthicsAgenda {
  id: string;
  title: string;
  category: 'bias' | 'privacy' | 'safety' | 'transparency' | 'accountability';
  submittedBy: string;
  submittedAt: string;
  description: string;
  status: 'submitted' | 'reviewing' | 'voted' | 'finalized';
  decision?: 'approve' | 'reject' | 'conditional';
}

export type Vote = 'approve' | 'reject' | 'abstain';

export interface VoteRecord {
  memberId: string;
  vote: Vote;
  rationale?: string;
  at: string;
}

export interface VoteSummary {
  agendaId: string;
  approve: number;
  reject: number;
  abstain: number;
  totalVoters: number;
  decision: 'approve' | 'reject' | 'conditional';
  quorumReached: boolean;
}

const ETHICS_PRINCIPLES: Array<{ id: string; title: string }> = [
  { id: 'E-1', title: '인간 존엄성 및 자율성' },
  { id: 'E-2', title: '공정성 및 비차별' },
  { id: 'E-3', title: '투명성 및 설명가능성' },
  { id: 'E-4', title: '책임성' },
  { id: 'E-5', title: '안전성 및 견고성' },
  { id: 'E-6', title: '프라이버시' },
  { id: 'E-7', title: '사회적 공익' },
];

// FR-ETH.2
export function listEthicsPrinciples(): Array<{ id: string; title: string }> {
  return ETHICS_PRINCIPLES.map((p) => ({ ...p }));
}

// FR-ETH.1, FR-ETH.3, FR-ETH.4, FR-ETH.5
export class EthicsCommittee {
  private agendas: Map<string, EthicsAgenda> = new Map();
  private votes: Map<string, VoteRecord[]> = new Map();
  private nextId = 1;

  constructor(
    private committeeSize: number = 7,
    private quorumRatio: number = 0.6,
  ) {}

  // FR-ETH.1
  submit(params: {
    title: string;
    category: EthicsAgenda['category'];
    submittedBy: string;
    description: string;
  }): EthicsAgenda {
    const now = new Date().toISOString();
    const ag: EthicsAgenda = {
      id: `eth-${this.nextId++}`,
      title: params.title,
      category: params.category,
      submittedBy: params.submittedBy,
      submittedAt: now,
      description: params.description,
      status: 'submitted',
    };
    this.agendas.set(ag.id, ag);
    this.votes.set(ag.id, []);
    return { ...ag };
  }

  markReviewing(agendaId: string): void {
    const ag = this.must(agendaId);
    ag.status = 'reviewing';
  }

  // FR-ETH.3
  recordVote(agendaId: string, vote: Omit<VoteRecord, 'at'>): void {
    const ag = this.must(agendaId);
    if (ag.status === 'finalized') {
      throw new Error(`Agenda already finalized: ${agendaId}`);
    }
    const votes = this.votes.get(agendaId)!;
    if (votes.some((v) => v.memberId === vote.memberId)) {
      throw new Error(`Duplicate vote: ${vote.memberId}`);
    }
    votes.push({ ...vote, at: new Date().toISOString() });
    ag.status = 'voted';
  }

  tally(agendaId: string): VoteSummary {
    const ag = this.must(agendaId);
    const votes = this.votes.get(agendaId) ?? [];
    const approve = votes.filter((v) => v.vote === 'approve').length;
    const reject = votes.filter((v) => v.vote === 'reject').length;
    const abstain = votes.filter((v) => v.vote === 'abstain').length;
    const quorumReached = votes.length >= Math.ceil(this.committeeSize * this.quorumRatio);
    let decision: 'approve' | 'reject' | 'conditional';
    if (!quorumReached) {
      decision = 'conditional';
    } else if (approve > reject && approve > abstain) {
      decision = 'approve';
    } else if (reject > approve) {
      decision = 'reject';
    } else {
      decision = 'conditional';
    }
    if (quorumReached && decision !== 'conditional') {
      ag.decision = decision;
      ag.status = 'finalized';
    }
    return {
      agendaId,
      approve,
      reject,
      abstain,
      totalVoters: votes.length,
      decision,
      quorumReached,
    };
  }

  // FR-ETH.4
  listHistory(): EthicsAgenda[] {
    return Array.from(this.agendas.values()).map((a) => ({ ...a }));
  }

  // FR-ETH.5: 분기 리포트
  quarterReport(year: number, quarter: 1 | 2 | 3 | 4): {
    period: string;
    total: number;
    byCategory: Record<string, number>;
    approveRate: number;
  } {
    const startMonth = (quarter - 1) * 3;
    const start = new Date(Date.UTC(year, startMonth, 1));
    const end = new Date(Date.UTC(year, startMonth + 3, 1));
    const inRange = this.listHistory().filter((a) => {
      const t = new Date(a.submittedAt).getTime();
      return t >= start.getTime() && t < end.getTime();
    });
    const byCategory: Record<string, number> = {};
    let approved = 0;
    for (const a of inRange) {
      byCategory[a.category] = (byCategory[a.category] ?? 0) + 1;
      if (a.decision === 'approve') approved++;
    }
    return {
      period: `${year}Q${quarter}`,
      total: inRange.length,
      byCategory,
      approveRate: inRange.length === 0 ? 0 : round4(approved / inRange.length),
    };
  }

  private must(id: string): EthicsAgenda {
    const a = this.agendas.get(id);
    if (!a) throw new Error(`Agenda not found: ${id}`);
    return a;
  }
}

function round4(n: number): number {
  return Math.round(n * 10_000) / 10_000;
}
