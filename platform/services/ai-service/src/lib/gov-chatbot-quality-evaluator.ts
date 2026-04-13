// SVC-AI-ADV-R464 Government Chatbot Quality Evaluator
// Design Ref: SVC-AI-ADV-R464.design.md
// Plan SC: FR-464.1~7
// CSAP D-06 / N2SF N-05

export type DataGrade = 'O' | 'C' | 'S';

export interface ChatPair {
  readonly question: string;
  readonly answer: string;
  readonly keywords: readonly string[];
}

export type QualityGrade = 'A' | 'B' | 'C' | 'D';

export interface QualityReport {
  readonly relevance: number;
  readonly clarity: number;
  readonly completeness: number;
  readonly totalScore: number;
  readonly grade: QualityGrade;
}

interface AuditEntry {
  readonly timestamp: string;
  readonly action: string;
  readonly details: Record<string, unknown>;
}

export class GovChatbotQualityEvaluator {
  private readonly auditLog: AuditEntry[] = [];

  evaluate(pair: ChatPair, grade: DataGrade = 'O'): QualityReport {
    if (grade === 'C' || grade === 'S') {
      throw new Error(`N2SF_BLOCKED: ${grade}등급 대화 데이터 차단 (N2SF N-05)`);
    }
    if (!pair.answer || pair.keywords.length === 0) {
      throw new Error('INVALID_PAIR: empty answer or keywords');
    }

    const hits = pair.keywords.filter((k) => pair.answer.includes(k)).length;
    const relevance = Number(((hits / pair.keywords.length) * 100).toFixed(2));

    const over = Math.max(0, pair.answer.length - 150);
    const clarityRaw = 100 - Math.floor(over / 10) * 10;
    const clarity = Math.max(0, clarityRaw);

    const completeness = Number(((hits / pair.keywords.length) * 100).toFixed(2));

    const totalScore = Number(
      ((relevance + clarity + completeness) / 3).toFixed(2),
    );

    let qGrade: QualityGrade = 'D';
    if (totalScore >= 85) qGrade = 'A';
    else if (totalScore >= 70) qGrade = 'B';
    else if (totalScore >= 55) qGrade = 'C';

    this.auditLog.push({
      timestamp: new Date().toISOString(),
      action: 'CHAT_EVAL',
      details: { totalScore, grade: qGrade },
    });

    return { relevance, clarity, completeness, totalScore, grade: qGrade };
  }

  getAuditLog(): readonly AuditEntry[] {
    return [...this.auditLog];
  }
}
