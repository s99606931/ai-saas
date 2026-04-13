// SVC-AI-ADV-R443 지능형 교육 지원 시스템
// Design Ref: SVC-AI-ADV-R443.design.md
// Plan SC: FR-443.1~5
// CSAP D-06 / N2SF N-05

export type DataGrade = 'O' | 'C' | 'S';

export interface Student {
  readonly id: string;
  readonly scores: Record<string, number>;
}

export interface StudentPlan {
  readonly id: string;
  readonly weakSubjects: readonly string[];
  readonly recommendations: readonly string[];
}

export interface CohortReport {
  readonly cohortAvg: Record<string, number>;
  readonly plans: readonly StudentPlan[];
}

export interface AuditEntry {
  readonly timestamp: string;
  readonly action: string;
  readonly target: string;
  readonly details: Record<string, unknown>;
}

export class EducationSupportSystem {
  private readonly auditLog: AuditEntry[] = [];

  analyze(students: readonly Student[], grade: DataGrade = 'O'): CohortReport {
    if (grade === 'C' || grade === 'S') {
      throw new Error(`N2SF_BLOCKED: ${grade}등급 학생 데이터 차단 (N2SF N-05)`);
    }
    if (students.length === 0) return { cohortAvg: {}, plans: [] };

    const sums = new Map<string, { sum: number; n: number }>();
    for (const s of students) {
      if (!s.id) throw new Error('INVALID_STUDENT_ID');
      for (const [subj, v] of Object.entries(s.scores)) {
        if (v < 0 || v > 100) throw new Error(`INVALID_SCORE: ${subj}`);
        const prev = sums.get(subj) ?? { sum: 0, n: 0 };
        prev.sum += v;
        prev.n += 1;
        sums.set(subj, prev);
      }
    }

    const cohortAvg: Record<string, number> = {};
    for (const [subj, { sum, n }] of sums) {
      cohortAvg[subj] = Number((sum / n).toFixed(2));
    }

    const plans: StudentPlan[] = students.map((s) => {
      const weakSubjects: string[] = [];
      const recommendations: string[] = [];
      for (const [subj, v] of Object.entries(s.scores)) {
        if (v < (cohortAvg[subj] ?? 0) - 10) {
          weakSubjects.push(subj);
          recommendations.push(`${subj} 보충 프로그램`);
        }
      }
      return { id: s.id, weakSubjects, recommendations };
    });

    this.record('ANALYZE', 'cohort', {
      students: students.length,
      weakCount: plans.filter((p) => p.weakSubjects.length > 0).length,
    });
    return { cohortAvg, plans };
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
