// Design Ref: §핵심 알고리즘 — 카테고리별 priority 정렬 매뉴얼 + TOC
// Plan SC: FR-R290.1~5

enum DataGrade { C = 'C', S = 'S', O = 'O' }

interface ProcedureStep {
  stepNumber: number;
  description: string;
  caution?: string;
}

interface Procedure {
  id: string;
  title: string;
  category: string;
  priority: number;
  steps: ProcedureStep[];
}

interface ManualSection {
  procedureId: string;
  title: string;
  category: string;
  steps: ProcedureStep[];
}

interface TocEntry {
  category: string;
  procedures: Array<{ index: number; title: string }>;
}

interface AuditEntry {
  timestamp: string;
  action: string;
  details: Record<string, unknown>;
}

// Plan SC: FR-R290.5
function guardDataGrade(grade: DataGrade): void {
  if (grade === DataGrade.C || grade === DataGrade.S) {
    throw new Error(`BLOCKED: ${grade}등급 데이터는 AI API 전송 금지 (N2SF N-05)`);
  }
}

export class OperationsManualGeneratorAI {
  private procedures = new Map<string, Procedure>();
  private auditLog: AuditEntry[] = [];

  private log(action: string, details: Record<string, unknown>): void {
    this.auditLog.push({ timestamp: new Date().toISOString(), action, details });
  }

  // Plan SC: FR-R290.1
  registerProcedure(id: string, title: string, category: string, priority: number = 0): void {
    this.procedures.set(id, { id, title, category, priority, steps: [] });
    this.log('REGISTER_PROCEDURE', { id, title, category, priority });
  }

  // Plan SC: FR-R290.2
  addStep(procedureId: string, stepNumber: number, description: string, caution?: string, grade: DataGrade = DataGrade.O): void {
    guardDataGrade(grade);
    const proc = this.procedures.get(procedureId);
    if (!proc) throw new Error(`절차 미등록: ${procedureId}`);
    proc.steps.push({ stepNumber, description, caution });
    proc.steps.sort((a, b) => a.stepNumber - b.stepNumber);
    this.log('ADD_STEP', { procedureId, stepNumber, description });
  }

  // Plan SC: FR-R290.3
  generateManual(category?: string): ManualSection[] {
    let procs = Array.from(this.procedures.values());
    if (category) procs = procs.filter(p => p.category === category);
    procs.sort((a, b) => a.priority - b.priority);
    this.log('GENERATE_MANUAL', { category, procedureCount: procs.length });
    return procs.map(p => ({ procedureId: p.id, title: p.title, category: p.category, steps: [...p.steps] }));
  }

  // Plan SC: FR-R290.4
  generateTOC(): TocEntry[] {
    const categoryMap = new Map<string, Array<{ index: number; title: string }>>();
    const sorted = Array.from(this.procedures.values()).sort((a, b) => a.priority - b.priority);
    let globalIndex = 1;
    for (const proc of sorted) {
      if (!categoryMap.has(proc.category)) categoryMap.set(proc.category, []);
      categoryMap.get(proc.category)!.push({ index: globalIndex++, title: proc.title });
    }
    return Array.from(categoryMap.entries()).map(([category, procedures]) => ({ category, procedures }));
  }

  // Plan SC: FR-R290.5
  getAuditLog(): AuditEntry[] {
    return [...this.auditLog];
  }
}
