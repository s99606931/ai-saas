// Design Ref: §정부 혁신랩 AI — 아이디어 평가 및 우선순위화
// Plan SC: FR-R610.1~6

const DATA_GRADE_BLOCK = ['C', 'S'] as const;
type DataGrade = 'C' | 'S' | 'O';

function blockClassifiedData(grade: DataGrade): void {
  if ((DATA_GRADE_BLOCK as readonly string[]).includes(grade)) {
    throw new Error(`BLOCKED: ${grade}등급 데이터는 AI API 전송 금지 (N2SF N-05)`);
  }
}

export type InnovationCategory = 'citizen_service' | 'administrative_efficiency' | 'policy_design' | 'digital_transformation' | 'participation';

export interface InnovationIdea {
  ideaId: string;
  title: string;
  category: InnovationCategory;
  feasibility: number; // 1~10
  impact: number; // 1~10
  cost: number; // 1~10 (낮을수록 좋음)
  stakeholderSupport: number; // 1~10
}

export interface PrioritizedIdea {
  ideaId: string;
  priorityScore: number;
  recommendation: 'pilot' | 'pursue' | 'defer' | 'reject';
}

interface AuditEntry {
  timestamp: string;
  action: string;
  detail: Record<string, unknown>;
}

export class GovernmentInnovationLabAI {
  private ideas = new Map<string, InnovationIdea>();
  private auditLog: AuditEntry[] = [];

  private append(action: string, detail: Record<string, unknown>): void {
    this.auditLog.push({ timestamp: new Date().toISOString(), action, detail });
  }

  // Plan SC: FR-R610.1
  submitIdea(idea: InnovationIdea, grade: DataGrade = 'O'): void {
    blockClassifiedData(grade);
    const checkRange = (name: string, val: number) => {
      if (val < 1 || val > 10) throw new Error(`${name}은 1~10 범위여야 합니다`);
    };
    checkRange('실현가능성', idea.feasibility);
    checkRange('임팩트', idea.impact);
    checkRange('비용', idea.cost);
    checkRange('이해관계자 지지', idea.stakeholderSupport);
    this.ideas.set(idea.ideaId, { ...idea });
    this.append('SUBMIT_IDEA', { ideaId: idea.ideaId, category: idea.category });
  }

  // Plan SC: FR-R610.2
  prioritize(ideaId: string, grade: DataGrade = 'O'): PrioritizedIdea {
    blockClassifiedData(grade);
    const idea = this.ideas.get(ideaId);
    if (!idea) throw new Error(`아이디어 미등록: ${ideaId}`);

    const costInverted = 11 - idea.cost; // 비용이 낮을수록 점수 상승
    const score =
      idea.feasibility * 2.5 +
      idea.impact * 3.0 +
      costInverted * 2.0 +
      idea.stakeholderSupport * 2.5;
    const priorityScore = Math.round(score * 100) / 100;

    const recommendation: PrioritizedIdea['recommendation'] =
      priorityScore >= 80 ? 'pilot' : priorityScore >= 60 ? 'pursue' : priorityScore >= 40 ? 'defer' : 'reject';

    this.append('PRIORITIZE', { ideaId, priorityScore, recommendation });
    return { ideaId, priorityScore, recommendation };
  }

  // Plan SC: FR-R610.3
  topIdeas(topK = 5): PrioritizedIdea[] {
    const results: PrioritizedIdea[] = [];
    for (const id of this.ideas.keys()) results.push(this.prioritize(id));
    results.sort((a, b) => b.priorityScore - a.priorityScore);
    return results.slice(0, topK);
  }

  // Plan SC: FR-R610.4
  listByCategory(category: InnovationCategory): InnovationIdea[] {
    return Array.from(this.ideas.values())
      .filter(i => i.category === category)
      .map(i => ({ ...i }));
  }

  // Plan SC: FR-R610.5
  countByRecommendation(): Record<PrioritizedIdea['recommendation'], number> {
    const counts: Record<PrioritizedIdea['recommendation'], number> = {
      pilot: 0,
      pursue: 0,
      defer: 0,
      reject: 0,
    };
    for (const id of this.ideas.keys()) {
      const p = this.prioritize(id);
      counts[p.recommendation]++;
    }
    return counts;
  }

  // Plan SC: FR-R610.6
  getAuditLog(): AuditEntry[] {
    return [...this.auditLog];
  }
}
