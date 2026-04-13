// SVC-AI-ADV-R399 Smart Document Router
// Design Ref: SVC-AI-ADV-R399.design.md
// Plan SC: SC-R399-1~5
// CSAP D-06 / N2SF N-05

export type DataGrade = 'O' | 'C' | 'S';

export interface StaffMember {
  readonly id: string;
  load: number;
}

export interface Department {
  readonly id: string;
  readonly name: string;
  readonly keywords: readonly string[];
  readonly staff: StaffMember[];
}

export interface RoutingResult {
  readonly departmentId: string;
  readonly assigneeId: string;
  readonly confidence: number;
  readonly matchCount: number;
}

export interface AuditEntry {
  readonly timestamp: string;
  readonly action: string;
  readonly target: string;
  readonly details: Record<string, unknown>;
}

export class SmartDocumentRouter {
  private readonly departments = new Map<string, Department>();
  private readonly auditLog: AuditEntry[] = [];

  registerDepartment(dept: Department): void {
    if (dept.staff.length === 0) {
      throw new Error('INVALID_DEPT: 담당자 최소 1명 필요');
    }
    this.departments.set(dept.id, {
      ...dept,
      staff: dept.staff.map((s) => ({ ...s })),
    });
    this.record('REGISTER_DEPT', dept.id, { name: dept.name });
  }

  route(documentText: string, grade: DataGrade = 'O'): RoutingResult {
    if (grade === 'C' || grade === 'S') {
      throw new Error(`N2SF_BLOCKED: ${grade}등급 문서 차단 (N2SF N-05)`);
    }

    const scores: { dept: Department; score: number }[] = [];
    for (const dept of this.departments.values()) {
      const score = dept.keywords.reduce(
        (n, kw) => n + (documentText.includes(kw) ? 1 : 0),
        0,
      );
      scores.push({ dept, score });
    }

    const totalScore = scores.reduce((s, x) => s + x.score, 0);
    scores.sort((a, b) => b.score - a.score);
    const top = scores[0];

    if (!top || top.score === 0) {
      const result: RoutingResult = {
        departmentId: 'unassigned',
        assigneeId: 'unassigned',
        confidence: 0,
        matchCount: 0,
      };
      this.record('ROUTE', 'unassigned', {});
      return result;
    }

    const confidence = Number((top.score / totalScore).toFixed(4));
    const sortedStaff = [...top.dept.staff].sort((a, b) => a.load - b.load);
    const assignee = sortedStaff[0];
    if (!assignee) {
      throw new Error('INTERNAL: 담당자 없음');
    }
    // 로드 증가
    const original = top.dept.staff.find((s) => s.id === assignee.id);
    if (original) original.load += 1;

    const result: RoutingResult = {
      departmentId: top.dept.id,
      assigneeId: assignee.id,
      confidence,
      matchCount: top.score,
    };
    this.record('ROUTE', top.dept.id, { assignee: assignee.id });
    return result;
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
