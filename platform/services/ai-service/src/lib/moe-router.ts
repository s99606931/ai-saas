// Design Ref: docs/02-design/mtus/SVC-AI-ADV-R83.design.md
// Plan SC: FR-R83.1~5 (SVC-AI-ADV-R83 Mixture of Experts 라우터)
// CSAP: D-06 감사 로그
//
// 키워드/복잡도 기반 경량 전문가 라우팅. top-k 선택 및 가중치 정규화.

export interface Expert {
  id: string;
  domain: string;
  keywords: string[];
  costPerCall?: number;
  isDefault?: boolean;
}

export interface ExpertScore {
  expertId: string;
  score: number;
}

export interface SelectResult {
  selected: ExpertScore[];
  totalExperts: number;
  fallback: boolean;
}

export interface AuditEvent {
  ts: string;
  action: 'REGISTER' | 'SCORE' | 'SELECT' | 'FALLBACK';
  details: Record<string, unknown>;
}

export class MoeRouter {
  private readonly experts = new Map<string, Expert>();
  private defaultId: string | null = null;
  private readonly auditLog: AuditEvent[] = [];

  /** FR-R83.1 */
  register(expert: Expert): void {
    if (!expert.id || !expert.domain) throw new Error('invalid expert');
    if (!Array.isArray(expert.keywords)) throw new Error('keywords required');
    this.experts.set(expert.id, expert);
    if (expert.isDefault) this.defaultId = expert.id;
    this.log('REGISTER', { id: expert.id, domain: expert.domain });
  }

  /** FR-R83.2~4: 입력으로 top-k 전문가 선택 */
  select(query: string, k = 1): SelectResult {
    const q = query.toLowerCase();
    const boost = this.complexityBoost(query);

    const scores: ExpertScore[] = [];
    this.experts.forEach((e) => {
      if (e.isDefault) return; // default는 폴백 전용
      const matched = e.keywords.filter((kw) => q.includes(kw.toLowerCase())).length;
      if (matched === 0) return;
      const raw = (matched / Math.max(1, e.keywords.length)) * boost;
      scores.push({ expertId: e.id, score: raw });
    });

    this.log('SCORE', {
      query: q.slice(0, 40),
      candidates: scores.length,
      boost,
    });

    if (scores.length === 0) {
      const fallbackId = this.defaultId;
      if (!fallbackId) {
        this.log('FALLBACK', { reason: 'no_default' });
        return { selected: [], totalExperts: this.experts.size, fallback: true };
      }
      this.log('FALLBACK', { to: fallbackId });
      return {
        selected: [{ expertId: fallbackId, score: 1 }],
        totalExperts: this.experts.size,
        fallback: true,
      };
    }

    scores.sort((a, b) => b.score - a.score);
    const top = scores.slice(0, k);
    const sum = top.reduce((s, x) => s + x.score, 0);
    const normalized = top.map((x) => ({
      expertId: x.expertId,
      score: sum > 0 ? x.score / sum : 0,
    }));

    this.log('SELECT', {
      k,
      selected: normalized.map((x) => x.expertId),
    });

    return {
      selected: normalized,
      totalExperts: this.experts.size,
      fallback: false,
    };
  }

  /** FR-R83.5 */
  getAuditLog(): readonly AuditEvent[] {
    return this.auditLog.slice();
  }

  private complexityBoost(query: string): number {
    let boost = 1;
    if (query.length > 50) boost *= 1.1;
    if (query.includes('```')) boost *= 1.3;
    return boost;
  }

  private log(action: AuditEvent['action'], details: Record<string, unknown>): void {
    this.auditLog.push({ ts: new Date().toISOString(), action, details });
  }
}

export function createMoeRouter(): MoeRouter {
  return new MoeRouter();
}
