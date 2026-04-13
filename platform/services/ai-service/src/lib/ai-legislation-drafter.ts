// SVC-AI-ADV-R484 AI Legislation Drafter
// Design Ref: SVC-AI-ADV-R484.design.md §법안작성
// Plan SC: FR-484.1~6
// CSAP D-06 / N2SF N-05

export type DataGrade = 'O' | 'C' | 'S';

export interface LegislationRequest {
  readonly requestId: string;
  readonly title: string;
  readonly purpose: string;
  readonly category: 'WELFARE' | 'TAX' | 'EDUCATION' | 'ENVIRONMENT' | 'SECURITY' | 'TECHNOLOGY';
  readonly stakeholders: readonly string[];
}

export interface LegislationDraft {
  readonly requestId: string;
  readonly title: string;
  readonly preamble: string;
  readonly articles: readonly string[];
  readonly impactScore: number;
  readonly conflictWarnings: readonly string[];
}

interface AuditEntry {
  readonly timestamp: string;
  readonly action: string;
  readonly details: Record<string, unknown>;
}

const ARTICLE_TEMPLATES: Record<LegislationRequest['category'], readonly string[]> = {
  WELFARE: [
    '제1조(목적) 이 법은 국민의 복지 증진을 목적으로 한다.',
    '제2조(정의) 이 법에서 사용하는 용어의 뜻은 다음과 같다.',
    '제3조(국가의 책무) 국가는 복지정책을 수립·시행하여야 한다.',
  ],
  TAX: [
    '제1조(목적) 이 법은 조세의 부과 및 징수를 정하는 것을 목적으로 한다.',
    '제2조(과세대상) 과세대상은 다음 각 호와 같다.',
    '제3조(세율) 세율은 별표에 따른다.',
  ],
  EDUCATION: [
    '제1조(목적) 이 법은 교육의 기회균등을 보장한다.',
    '제2조(국가의 의무) 국가는 교육환경을 조성한다.',
    '제3조(교육과정) 교육과정은 교육부장관이 정한다.',
  ],
  ENVIRONMENT: [
    '제1조(목적) 이 법은 환경 보전을 목적으로 한다.',
    '제2조(오염원 관리) 오염원은 등록·관리된다.',
    '제3조(벌칙) 위반자는 벌금에 처한다.',
  ],
  SECURITY: [
    '제1조(목적) 이 법은 국가안보를 강화한다.',
    '제2조(보안조치) 정부는 보안조치를 시행한다.',
    '제3조(처벌) 위반행위는 형법에 따른다.',
  ],
  TECHNOLOGY: [
    '제1조(목적) 이 법은 기술혁신을 촉진한다.',
    '제2조(연구개발 지원) 정부는 연구개발을 지원한다.',
    '제3조(표준화) 표준화 체계를 구축한다.',
  ],
};

function block(grade: DataGrade): void {
  if (grade === 'C' || grade === 'S') {
    throw new Error(`N2SF_BLOCKED: ${grade}등급 법안 데이터 차단 (N2SF N-05)`);
  }
}

export class AiLegislationDrafter {
  private readonly auditLog: AuditEntry[] = [];

  draft(request: LegislationRequest, grade: DataGrade = 'O'): LegislationDraft {
    block(grade);

    const templates = ARTICLE_TEMPLATES[request.category];
    const articles = templates.map((a) => a);

    const stakeholderArticle = `제${articles.length + 1}조(이해관계자) 다음 각 호의 자는 본 법의 적용을 받는다: ${request.stakeholders.join(', ')}.`;
    const finalArticles = [...articles, stakeholderArticle];

    const impactScore = Math.min(
      100,
      30 + request.stakeholders.length * 10 + (request.purpose.length > 50 ? 20 : 10),
    );

    const conflictWarnings: string[] = [];
    if (request.category === 'TAX' && request.stakeholders.includes('자영업자')) {
      conflictWarnings.push('소상공인 보호법과 충돌 가능성');
    }
    if (request.category === 'SECURITY') {
      conflictWarnings.push('개인정보보호법 검토 필요');
    }

    const preamble = `「${request.title}」은(는) ${request.purpose}을(를) 위하여 다음과 같이 제정한다.`;

    this.appendAudit('LEGIS_DRAFT', {
      requestId: request.requestId,
      category: request.category,
      articleCount: finalArticles.length,
    });

    return {
      requestId: request.requestId,
      title: request.title,
      preamble,
      articles: finalArticles,
      impactScore,
      conflictWarnings,
    };
  }

  reviewClarity(text: string): number {
    const sentences = text.split(/[.。]/).filter((s) => s.trim().length > 0);
    if (sentences.length === 0) return 0;
    const avgLen = sentences.reduce((acc, s) => acc + s.length, 0) / sentences.length;
    const score = avgLen < 60 ? 90 : avgLen < 100 ? 70 : avgLen < 150 ? 50 : 30;
    this.appendAudit('CLARITY', { sentences: sentences.length, avgLen, score });
    return score;
  }

  getAuditLog(): readonly AuditEntry[] {
    return [...this.auditLog];
  }

  private appendAudit(action: string, details: Record<string, unknown>): void {
    this.auditLog.push({
      timestamp: new Date().toISOString(),
      action,
      details,
    });
  }
}
