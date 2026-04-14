// Design Ref: SVC-AI-ADV-R678.design.md — AI기반 공공 인력 최적화 v2
// Plan SC: FR-R678.1~5

export type LoadLevel = 'OVERLOADED' | 'BUSY' | 'NORMAL';
export type WorkforceAction = 'HOLD' | 'REASSIGN' | 'HIRE';

interface Department { deptId: string; name: string; headcount: number }
interface WorkLoad {
  loadId: string;
  deptId: string;
  casesPerDay: number;
  avgOvertimeHours: number;
}
interface WorkforceAdvice {
  loadId: string;
  deptId: string;
  level: LoadLevel;
  action: WorkforceAction;
}
interface AuditEntry { timestamp: string; action: string; details?: Record<string, unknown> }

const ACTION_RANK: WorkforceAction[] = ['HOLD', 'REASSIGN', 'HIRE'];

function rankToAction(rank: number): WorkforceAction {
  const idx = Math.max(0, Math.min(ACTION_RANK.length - 1, rank));
  return ACTION_RANK[idx]!;
}

export class PublicWorkforceOptimizerAIV2 {
  private departments = new Map<string, Department>();
  private advices: WorkforceAdvice[] = [];
  private auditLog: AuditEntry[] = [];

  registerDepartment(dept: Department): void {
    if (dept.headcount <= 0) {
      throw new Error('INVALID_HEADCOUNT');
    }
    this.departments.set(dept.deptId, dept);
    this.auditLog.push({
      timestamp: new Date().toISOString(),
      action: 'REGISTER_DEPT',
      details: { deptId: dept.deptId, name: dept.name, headcount: dept.headcount },
    });
  }

  reportLoad(load: WorkLoad, dataGrade?: string): WorkforceAdvice {
    if (dataGrade === 'C' || dataGrade === 'S') {
      throw new Error(`BLOCKED: ${dataGrade}등급 AI API 전송 금지 (N2SF N-05)`);
    }
    const dept = this.departments.get(load.deptId);
    if (!dept) {
      throw new Error(`UNKNOWN_DEPT: ${load.deptId}`);
    }
    if (load.casesPerDay < 0 || load.avgOvertimeHours < 0) {
      throw new Error('INVALID_LOAD');
    }

    const perCapita = load.casesPerDay / dept.headcount;
    let level: LoadLevel;
    let baseRank: number;
    if (perCapita >= 40) {
      level = 'OVERLOADED';
      baseRank = 2;
    } else if (perCapita >= 25) {
      level = 'BUSY';
      baseRank = 1;
    } else {
      level = 'NORMAL';
      baseRank = 0;
    }

    const finalRank = load.avgOvertimeHours >= 4 ? baseRank + 1 : baseRank;
    const action = rankToAction(finalRank);

    const advice: WorkforceAdvice = {
      loadId: load.loadId,
      deptId: load.deptId,
      level,
      action,
    };
    this.advices.push(advice);
    this.auditLog.push({
      timestamp: new Date().toISOString(),
      action: 'REPORT_LOAD',
      details: { loadId: load.loadId, deptId: load.deptId, level, action },
    });
    return advice;
  }

  getHireRecommendations(): WorkforceAdvice[] {
    return this.advices.filter((a) => a.action === 'HIRE');
  }

  getAuditLog(): AuditEntry[] {
    return [...this.auditLog];
  }
}
