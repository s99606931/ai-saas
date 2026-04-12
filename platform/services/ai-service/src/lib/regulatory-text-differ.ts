// SVC-AI-ADV-R365 Regulatory Text Differ
// Design Ref: SVC-AI-ADV-R365.design.md
// Plan SC: SC-R365-1~4
// CSAP D-12 / N2SF N-05

export type DataGrade = 'O' | 'C' | 'S';

export interface DiffResult {
  readonly added: readonly string[];
  readonly removed: readonly string[];
  readonly unchanged: readonly string[];
  readonly impactScore: number;
}

export interface AuditEntry {
  readonly timestamp: string;
  readonly action: string;
  readonly target: string;
  readonly details: Record<string, unknown>;
}

export class RegulatoryTextDiffer {
  private readonly auditLog: AuditEntry[] = [];

  diff(before: string, after: string, grade: DataGrade = 'O'): DiffResult {
    if (grade === 'C' || grade === 'S') {
      throw new Error(`N2SF_BLOCKED: ${grade}등급 규정 텍스트 차단 (N2SF N-05)`);
    }

    const beforeLines = this.splitLines(before);
    const afterLines = this.splitLines(after);
    const beforeSet = new Set(beforeLines);
    const afterSet = new Set(afterLines);

    const added: string[] = [];
    const removed: string[] = [];
    const unchanged: string[] = [];

    for (const line of afterLines) {
      if (!beforeSet.has(line)) added.push(line);
      else unchanged.push(line);
    }
    for (const line of beforeLines) {
      if (!afterSet.has(line)) removed.push(line);
    }

    const maxSize = Math.max(beforeLines.length, afterLines.length, 1);
    const impactScore = Number(((added.length + removed.length) / maxSize).toFixed(4));

    const result: DiffResult = {
      added,
      removed,
      unchanged,
      impactScore: Math.min(1, impactScore),
    };

    this.record('DIFF', 'regulation', {
      added: added.length,
      removed: removed.length,
      impactScore: result.impactScore,
    });

    return result;
  }

  getAuditLog(): readonly AuditEntry[] {
    return this.auditLog;
  }

  private splitLines(text: string): string[] {
    return text
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l.length > 0);
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
