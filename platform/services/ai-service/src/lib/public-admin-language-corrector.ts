// Design Ref: §핵심 알고리즘 — 비표준 용어 탐지 + 교정 적용
// Plan SC: FR-R287.1~5

enum DataGrade { C = 'C', S = 'S', O = 'O' }

interface TermEntry {
  nonStandard: string;
  standard: string;
}

interface InspectionResult {
  totalIssues: number;
  suggestions: Array<{ nonStandard: string; standard: string; count: number }>;
}

interface CorrectionResult {
  original: string;
  corrected: string;
  correctionCount: number;
}

interface AuditEntry {
  timestamp: string;
  action: string;
  details: Record<string, unknown>;
}

// Plan SC: FR-R287.5
function guardDataGrade(grade: DataGrade): void {
  if (grade === DataGrade.C || grade === DataGrade.S) {
    throw new Error(`BLOCKED: ${grade}등급 데이터는 AI API 전송 금지 (N2SF N-05)`);
  }
}

function countOccurrences(text: string, term: string): number {
  if (term.length === 0) return 0;
  let count = 0;
  let pos = 0;
  while ((pos = text.indexOf(term, pos)) !== -1) { count++; pos += term.length; }
  return count;
}

export class PublicAdminLanguageCorrector {
  private terms: TermEntry[] = [];
  private auditLog: AuditEntry[] = [];

  private log(action: string, details: Record<string, unknown>): void {
    this.auditLog.push({ timestamp: new Date().toISOString(), action, details });
  }

  // Plan SC: FR-R287.1
  registerTerm(nonStandard: string, standard: string): void {
    this.terms.push({ nonStandard, standard });
    this.log('REGISTER_TERM', { nonStandard, standard });
  }

  // Plan SC: FR-R287.2 + R287.3
  inspect(text: string, grade: DataGrade = DataGrade.O): InspectionResult {
    guardDataGrade(grade);
    const suggestions: Array<{ nonStandard: string; standard: string; count: number }> = [];
    for (const term of this.terms) {
      const count = countOccurrences(text, term.nonStandard);
      if (count > 0) suggestions.push({ nonStandard: term.nonStandard, standard: term.standard, count });
    }
    this.log('INSPECT', { textLength: text.length, issuesFound: suggestions.length });
    return { totalIssues: suggestions.reduce((s, sg) => s + sg.count, 0), suggestions };
  }

  // Plan SC: FR-R287.4
  correct(text: string, grade: DataGrade = DataGrade.O): CorrectionResult {
    guardDataGrade(grade);
    let corrected = text;
    let correctionCount = 0;
    for (const term of this.terms) {
      const count = countOccurrences(corrected, term.nonStandard);
      if (count > 0) {
        corrected = corrected.split(term.nonStandard).join(term.standard);
        correctionCount += count;
      }
    }
    this.log('CORRECT', { correctionCount });
    return { original: text, corrected, correctionCount };
  }

  // Plan SC: FR-R287.5
  getAuditLog(): AuditEntry[] {
    return [...this.auditLog];
  }
}
