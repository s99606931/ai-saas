// Design Ref: SVC-AI-ADV-R675.design.md — AI기반 코드 리팩토링 자문 v2
// Plan SC: FR-R675.1~5

export type ComplexityLevel = 'CRITICAL' | 'HIGH' | 'MODERATE';
export type RefactorAction = 'REVIEW' | 'SIMPLIFY' | 'SPLIT';

interface CodeModule { moduleId: string; language: string; loc: number }
interface CodeMetric {
  metricId: string;
  moduleId: string;
  cyclomatic: number;
}
interface RefactorAdvice {
  metricId: string;
  moduleId: string;
  level: ComplexityLevel;
  action: RefactorAction;
}
interface AuditEntry { timestamp: string; action: string; details?: Record<string, unknown> }

const ACTION_RANK: RefactorAction[] = ['REVIEW', 'SIMPLIFY', 'SPLIT'];

function rankToAction(rank: number): RefactorAction {
  const idx = Math.max(0, Math.min(ACTION_RANK.length - 1, rank));
  return ACTION_RANK[idx]!;
}

export class AICodeRefactoringAdvisorV2 {
  private modules = new Map<string, CodeModule>();
  private advices: RefactorAdvice[] = [];
  private auditLog: AuditEntry[] = [];

  registerModule(mod: CodeModule): void {
    this.modules.set(mod.moduleId, mod);
    this.auditLog.push({
      timestamp: new Date().toISOString(),
      action: 'REGISTER_MODULE',
      details: { moduleId: mod.moduleId, language: mod.language, loc: mod.loc },
    });
  }

  analyzeMetrics(metric: CodeMetric, dataGrade?: string): RefactorAdvice {
    if (dataGrade === 'C' || dataGrade === 'S') {
      throw new Error(`BLOCKED: ${dataGrade}등급 AI API 전송 금지 (N2SF N-05)`);
    }
    const mod = this.modules.get(metric.moduleId);
    if (!mod) {
      throw new Error(`UNKNOWN_MODULE: ${metric.moduleId}`);
    }
    if (metric.cyclomatic < 0) {
      throw new Error('INVALID_CYCLOMATIC');
    }

    let level: ComplexityLevel;
    let baseRank: number;
    if (metric.cyclomatic >= 20) {
      level = 'CRITICAL';
      baseRank = 2;
    } else if (metric.cyclomatic >= 10) {
      level = 'HIGH';
      baseRank = 1;
    } else {
      level = 'MODERATE';
      baseRank = 0;
    }

    const finalRank = mod.loc > 800 ? baseRank + 1 : baseRank;
    const action = rankToAction(finalRank);

    const advice: RefactorAdvice = {
      metricId: metric.metricId,
      moduleId: metric.moduleId,
      level,
      action,
    };
    this.advices.push(advice);
    this.auditLog.push({
      timestamp: new Date().toISOString(),
      action: 'ANALYZE_METRIC',
      details: { metricId: metric.metricId, moduleId: metric.moduleId, level, action },
    });
    return advice;
  }

  getSplitCandidates(): RefactorAdvice[] {
    return this.advices.filter((a) => a.action === 'SPLIT');
  }

  getAuditLog(): AuditEntry[] {
    return [...this.auditLog];
  }
}
