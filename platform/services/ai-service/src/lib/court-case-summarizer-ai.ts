// SVC-AI-ADV-R445 법원 판례 요약기 AI
// Design Ref: SVC-AI-ADV-R445.design.md
// Plan SC: FR-445.1~5
// CSAP D-06 / N2SF N-05

export type DataGrade = 'O' | 'C' | 'S';

export type Section = 'issues' | 'rulings' | 'conclusion';

export interface CaseSummary {
  readonly issues: string;
  readonly rulings: string;
  readonly conclusion: string;
  readonly found: readonly Section[];
}

export interface AuditEntry {
  readonly timestamp: string;
  readonly action: string;
  readonly target: string;
  readonly details: Record<string, unknown>;
}

export class CourtCaseSummarizerAI {
  private readonly auditLog: AuditEntry[] = [];

  summarize(paragraphs: readonly string[], grade: DataGrade = 'O'): CaseSummary {
    if (grade === 'C' || grade === 'S') {
      throw new Error(`N2SF_BLOCKED: ${grade}등급 판례 차단 (N2SF N-05)`);
    }
    if (paragraphs.length === 0) {
      return { issues: '', rulings: '', conclusion: '', found: [] };
    }

    const buckets: Record<Section, string[]> = {
      issues: [],
      rulings: [],
      conclusion: [],
    };
    let current: Section | null = null;

    for (const raw of paragraphs) {
      const p = raw.trim();
      if (!p) continue;
      const detected = this.detectSection(p);
      if (detected) {
        current = detected;
        continue;
      }
      if (current) {
        buckets[current].push(p);
      }
    }

    const found: Section[] = [];
    for (const s of ['issues', 'rulings', 'conclusion'] as Section[]) {
      if (buckets[s].length > 0) found.push(s);
    }

    const summary: CaseSummary = {
      issues: buckets.issues.join(' '),
      rulings: buckets.rulings.join(' '),
      conclusion: buckets.conclusion.join(' '),
      found,
    };
    this.record('SUMMARIZE', 'case', { paragraphs: paragraphs.length, found });
    return summary;
  }

  private detectSection(line: string): Section | null {
    // 섹션 헤더로 인식: 라인 길이 ≤ 10 자 이고 키워드가 포함된 경우만
    const trimmed = line.trim();
    if (trimmed.length > 10) return null;
    if (trimmed === '쟁점' || trimmed === '쟁점 사항') return 'issues';
    if (trimmed === '판시사항' || trimmed === '판시') return 'rulings';
    if (trimmed === '결론') return 'conclusion';
    return null;
  }

  getAuditLog(): readonly AuditEntry[] {
    return this.auditLog;
  }

  private record(action: string, target: string, details: Record<string, unknown>): void {
    this.auditLog.push({
      timestamp: new Date().toISOString(),
      action,
      target,
      details,
    });
  }
}
