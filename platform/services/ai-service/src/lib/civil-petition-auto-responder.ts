// SVC-AI-ADV-R492 Civil Petition Auto Responder
// Design Ref: SVC-AI-ADV-R492.design.md §민원자동응답
// Plan SC: FR-492.1~6
// CSAP D-06 / N2SF N-05

export type DataGrade = 'O' | 'C' | 'S';

const DATA_GRADE_BLOCK = ['C', 'S'] as const;

function blockClassifiedData(grade: DataGrade): void {
  if ((DATA_GRADE_BLOCK as readonly string[]).includes(grade)) {
    throw new Error(`BLOCKED: ${grade}등급 데이터는 AI API 전송 금지 (N2SF N-05)`);
  }
}

export type PetitionCategory =
  | 'tax'
  | 'parking'
  | 'waste'
  | 'building'
  | 'welfare'
  | 'transport'
  | 'general';

export type Sentiment = 'urgent' | 'angry' | 'neutral' | 'satisfied';

export interface Petition {
  readonly petitionId: string;
  readonly text: string;
  readonly submittedAt: string;
}

export interface PetitionAnalysis {
  readonly petitionId: string;
  readonly category: PetitionCategory;
  readonly sentiment: Sentiment;
  readonly autoReplyDraft: string;
  readonly requiresHumanReview: boolean;
  readonly slaHours: number;
}

interface AuditEntry {
  readonly timestamp: string;
  readonly action: string;
  readonly detail: Record<string, unknown>;
}

const KEYWORDS: ReadonlyMap<PetitionCategory, readonly string[]> = new Map([
  ['tax', ['세금', '체납', '취득세', '재산세', '지방세']],
  ['parking', ['주차', '단속', '견인', '주정차']],
  ['waste', ['쓰레기', '재활용', '음식물', '대형폐기물']],
  ['building', ['건축', '인허가', '불법건축', '증축']],
  ['welfare', ['기초생활', '노인', '복지', '아동']],
  ['transport', ['버스', '지하철', '교통', '신호등']],
]);

const NEGATIVE_WORDS = ['짜증', '화', '분노', '불만', '항의'];
const URGENT_WORDS = ['긴급', '즉시', '당장', '응급'];
const POSITIVE_WORDS = ['감사', '고맙', '만족', '좋'];

export class CivilPetitionAutoResponder {
  private readonly auditLog: AuditEntry[] = [];

  analyze(petition: Petition, grade: DataGrade = 'O'): PetitionAnalysis {
    blockClassifiedData(grade);

    const category = this.detectCategory(petition.text);
    const sentiment = this.detectSentiment(petition.text);
    const requiresHumanReview =
      sentiment === 'angry' || sentiment === 'urgent' || category === 'welfare';

    const slaHours =
      sentiment === 'urgent' ? 2 : sentiment === 'angry' ? 8 : category === 'welfare' ? 24 : 72;

    const autoReplyDraft = this.draftReply(category, sentiment);

    this.appendAudit('ANALYZE', {
      petitionId: petition.petitionId,
      category,
      sentiment,
      requiresHumanReview,
    });

    return {
      petitionId: petition.petitionId,
      category,
      sentiment,
      autoReplyDraft,
      requiresHumanReview,
      slaHours,
    };
  }

  private detectCategory(text: string): PetitionCategory {
    for (const [cat, words] of KEYWORDS.entries()) {
      if (words.some((w) => text.includes(w))) return cat;
    }
    return 'general';
  }

  private detectSentiment(text: string): Sentiment {
    if (URGENT_WORDS.some((w) => text.includes(w))) return 'urgent';
    if (NEGATIVE_WORDS.some((w) => text.includes(w))) return 'angry';
    if (POSITIVE_WORDS.some((w) => text.includes(w))) return 'satisfied';
    return 'neutral';
  }

  private draftReply(category: PetitionCategory, sentiment: Sentiment): string {
    const opening =
      sentiment === 'angry'
        ? '불편을 드려 진심으로 사과드립니다.'
        : sentiment === 'urgent'
          ? '긴급 사안으로 인지하여 즉시 처리하겠습니다.'
          : '소중한 의견 감사합니다.';
    const middle =
      category === 'general'
        ? '담당 부서에 전달하여 검토 후 회신드리겠습니다.'
        : `해당 민원은 ${category} 담당과에서 처리합니다.`;
    return `${opening} ${middle}`;
  }

  getAuditLog(): readonly AuditEntry[] {
    return [...this.auditLog];
  }

  private appendAudit(action: string, detail: Record<string, unknown>): void {
    this.auditLog.push({
      timestamp: new Date().toISOString(),
      action,
      detail,
    });
  }
}
