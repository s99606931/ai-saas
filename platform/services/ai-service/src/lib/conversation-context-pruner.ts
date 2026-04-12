// Conversation Context Pruner — FR-R83.1~R83.5
// Design Ref: SVC-AI-ADV-R83 DESIGN §점수산정
// Plan SC: 토큰 절감 ≥ 40%, 키워드 유지율 ≥ 85%
// CSAP: D-06 감사 / N2SF: N-05 마스킹

export type DataGrade = 'C' | 'S' | 'O';
export type Role = 'system' | 'user' | 'assistant';

export interface Turn {
  role: Role;
  content: string;
  at?: number;
  grade?: DataGrade;
}

export interface ScoredTurn {
  role: Role;
  content: string;
  at?: number;
  grade?: DataGrade;
  index: number;
  score: number;
  tokens: number;
  keep: boolean;
}

export type Summarizer = (turns: Turn[]) => Promise<string>;

export interface PrunerOptions {
  maxTokens: number;
  keepSystem: boolean;
  keepLastN: number;
  keywords: string[];
  keywordBoost: number;
  userBoost: number;
  lengthPenalty: number;
}

export interface PruneResult {
  kept: Turn[];
  removed: number;
  summarized: number;
  totalTokens: number;
  originalTokens: number;
}

export type AuditAction =
  | 'PRUNE_START'
  | 'PRUNE_DONE'
  | 'REMOVED'
  | 'SUMMARIZED'
  | 'MASKED'
  | 'BLOCKED';

export interface AuditEvent {
  action: AuditAction;
  detail?: string;
  at: number;
}

const DEFAULT_OPTS: PrunerOptions = {
  maxTokens: 2000,
  keepSystem: true,
  keepLastN: 4,
  keywords: [],
  keywordBoost: 2,
  userBoost: 1.5,
  lengthPenalty: 0.01,
};

const EMAIL_RE = /[\w.+-]+@[\w-]+\.[\w.-]+/g;
const PHONE_RE = /\b0\d{1,2}-?\d{3,4}-?\d{4}\b/g;
const RRN_RE = /\b\d{6}-\d{7}\b/g;

function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

function maskPII(text: string): { masked: string; changed: boolean } {
  const original = text;
  const masked = text
    .replace(EMAIL_RE, '***@***')
    .replace(PHONE_RE, '***-****-****')
    .replace(RRN_RE, '******-*******');
  return { masked, changed: masked !== original };
}

export class ConversationContextPruner {
  private readonly opts: PrunerOptions;
  private readonly auditLog: AuditEvent[] = [];

  constructor(opts: Partial<PrunerOptions> = {}) {
    this.opts = { ...DEFAULT_OPTS, ...opts };
  }

  async prune(turns: Turn[], summarizer?: Summarizer): Promise<PruneResult> {
    this.audit('PRUNE_START', `turns=${turns.length}`);

    // 1. 등급 guard
    for (const t of turns) {
      if (t.grade && t.grade !== 'O') {
        this.audit('BLOCKED', `grade=${t.grade}`);
        throw new Error('PRUNE_GRADE_BLOCKED');
      }
    }

    // 2. 마스킹 적용된 ScoredTurn 생성
    const scored: ScoredTurn[] = turns.map((t, i) => {
      const { masked, changed } = maskPII(t.content);
      if (changed) {
        this.audit('MASKED', `turn=${i}`);
      }
      return {
        role: t.role,
        content: masked,
        at: t.at,
        grade: t.grade,
        index: i,
        tokens: estimateTokens(masked),
        score: 0,
        keep: false,
      };
    });

    const originalTokens = scored.reduce((s, t) => s + t.tokens, 0);
    const lastNStart = Math.max(0, scored.length - this.opts.keepLastN);

    // 3. 점수 산정
    for (const t of scored) {
      let score = 0;
      if (t.role === 'system') {
        score += 10;
        if (this.opts.keepSystem) {
          t.keep = true;
        }
      } else if (t.role === 'user') {
        score += this.opts.userBoost;
      } else {
        score += 1;
      }

      if (t.index >= lastNStart) {
        score += 5;
        t.keep = true;
      }

      const lowered = t.content.toLowerCase();
      for (const kw of this.opts.keywords) {
        if (lowered.includes(kw.toLowerCase())) {
          score += this.opts.keywordBoost;
        }
      }

      score -= t.tokens * this.opts.lengthPenalty;
      t.score = score;
    }

    // 4. 한도까지 선택
    const forcedKept = scored.filter((t) => t.keep);
    const forcedTokens = forcedKept.reduce((s, t) => s + t.tokens, 0);
    let budget = Math.max(0, this.opts.maxTokens - forcedTokens);

    const candidates = scored.filter((t) => !t.keep);
    candidates.sort((a, b) => b.score - a.score);

    for (const t of candidates) {
      if (t.tokens <= budget) {
        t.keep = true;
        budget -= t.tokens;
      }
    }

    // 5. 제거된 턴 요약 처리
    const removedTurns = scored.filter((t) => !t.keep);
    let summarized = 0;

    let summaryText: string | undefined;
    if (summarizer && removedTurns.length > 0) {
      try {
        summaryText = await summarizer(
          removedTurns.map((t) => ({
            role: t.role,
            content: t.content,
            at: t.at,
          })),
        );
        if (summaryText && estimateTokens(summaryText) <= budget) {
          summarized = removedTurns.length;
          this.audit('SUMMARIZED', `count=${removedTurns.length}`);
        } else {
          summaryText = undefined;
        }
      } catch {
        summaryText = undefined;
      }
    }

    // 6. 최종 kept (원본 순서 유지)
    const kept: Turn[] = [];
    let insertedSummary = false;
    for (const t of scored) {
      if (t.keep) {
        kept.push({ role: t.role, content: t.content, at: t.at, grade: t.grade });
      } else if (!insertedSummary && summaryText) {
        kept.push({
          role: 'system',
          content: `[요약] ${summaryText}`,
          at: t.at,
          grade: 'O',
        });
        insertedSummary = true;
      }
    }

    const removed = removedTurns.length - summarized;
    if (removed > 0) {
      this.audit('REMOVED', `count=${removed}`);
    }

    const totalTokens = kept.reduce((s, t) => s + estimateTokens(t.content), 0);
    this.audit('PRUNE_DONE', `kept=${kept.length}/${turns.length}`);

    return {
      kept,
      removed,
      summarized,
      totalTokens,
      originalTokens,
    };
  }

  getAuditLog(): AuditEvent[] {
    return [...this.auditLog];
  }

  private audit(action: AuditAction, detail?: string): void {
    this.auditLog.push({ action, detail, at: Date.now() });
  }
}
