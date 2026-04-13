// SVC-AI-ADV-R441 공공 서비스 자동화 워크플로우 빌더 (DSL)
// Design Ref: SVC-AI-ADV-R441.design.md
// Plan SC: FR-441.1~5
// CSAP D-06 / N2SF N-05

export type DataGrade = 'O' | 'C' | 'S';
export type Op = 'eq' | 'ne' | 'gt' | 'lt';

export interface Condition {
  readonly key: string;
  readonly op: Op;
  readonly value: unknown;
}

export interface Step {
  readonly id: string;
  readonly when?: Condition;
  readonly action: string;
  readonly set?: Record<string, unknown>;
}

export interface RunResult {
  readonly executed: readonly string[];
  readonly skipped: readonly string[];
  readonly context: Record<string, unknown>;
}

export interface AuditEntry {
  readonly timestamp: string;
  readonly action: string;
  readonly target: string;
  readonly details: Record<string, unknown>;
}

export class PublicWorkflowBuilder {
  private readonly auditLog: AuditEntry[] = [];

  run(
    dsl: readonly Step[],
    ctx: Record<string, unknown>,
    grade: DataGrade = 'O',
  ): RunResult {
    if (grade === 'C' || grade === 'S') {
      throw new Error(`N2SF_BLOCKED: ${grade}등급 워크플로우 실행 차단 (N2SF N-05)`);
    }

    const context: Record<string, unknown> = { ...ctx };
    const executed: string[] = [];
    const skipped: string[] = [];

    for (const step of dsl) {
      if (!step.id) throw new Error('INVALID_STEP: id 필수');
      if (step.when && !this.match(context, step.when)) {
        skipped.push(step.id);
        continue;
      }
      if (step.set) {
        for (const [k, v] of Object.entries(step.set)) {
          context[k] = v;
        }
      }
      executed.push(step.id);
      this.record('STEP_EXEC', step.id, { action: step.action });
    }

    this.record('RUN', 'workflow', {
      total: dsl.length,
      executed: executed.length,
      skipped: skipped.length,
    });
    return { executed, skipped, context };
  }

  private match(ctx: Record<string, unknown>, c: Condition): boolean {
    const v = ctx[c.key];
    switch (c.op) {
      case 'eq':
        return v === c.value;
      case 'ne':
        return v !== c.value;
      case 'gt':
        return typeof v === 'number' && typeof c.value === 'number' && v > c.value;
      case 'lt':
        return typeof v === 'number' && typeof c.value === 'number' && v < c.value;
      default:
        return false;
    }
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
