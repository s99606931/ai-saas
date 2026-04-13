// Design Ref: §인사 분석 KPI 계산 + 이탈 리스크 점수
// Plan SC: FR-R614.1~5

enum DataGrade { C = 'C', S = 'S', O = 'O' }

type Department = '기획' | '재정' | '복지' | '안전' | '문화';

interface Employee {
  id: string;
  department: Department;
  hireYear: number;
  performanceScore: number;
  overtimeHoursMonth: number;
  trainingHoursYear: number;
}

interface DepartmentKpi {
  department: Department;
  headcount: number;
  avgPerformance: number;
  avgTenure: number;
  turnoverRiskScore: number;
}

interface AuditEntry {
  timestamp: string;
  action: string;
  detail: Record<string, unknown>;
}

function blockClassifiedData(grade: DataGrade): void {
  if (grade === DataGrade.C || grade === DataGrade.S) {
    throw new Error(`BLOCKED: ${grade}등급 데이터는 AI API 전송 금지 (N2SF N-05)`);
  }
}

export class GovernmentHRAnalyticsAI {
  private employees = new Map<string, Employee>();
  private readonly audit: AuditEntry[] = [];
  private readonly currentYear: number = 2026;

  private log(action: string, detail: Record<string, unknown>): void {
    this.audit.push({ timestamp: new Date().toISOString(), action, detail });
  }

  // Plan SC: FR-R614.1
  registerEmployee(emp: Employee, grade: DataGrade = DataGrade.O): void {
    blockClassifiedData(grade);
    if (emp.performanceScore < 0 || emp.performanceScore > 100) {
      throw new Error('performanceScore 범위는 0~100');
    }
    this.employees.set(emp.id, emp);
    this.log('REGISTER_EMPLOYEE', { id: emp.id, dept: emp.department });
  }

  // Plan SC: FR-R614.2
  private riskScore(emp: Employee): number {
    let score = 0;
    if (emp.performanceScore < 50) score += 30;
    else if (emp.performanceScore < 70) score += 15;
    if (emp.overtimeHoursMonth > 40) score += 25;
    else if (emp.overtimeHoursMonth > 20) score += 10;
    if (emp.trainingHoursYear < 10) score += 15;
    const tenure = this.currentYear - emp.hireYear;
    if (tenure < 2) score += 10;
    return Math.min(100, score);
  }

  // Plan SC: FR-R614.3
  computeDepartmentKpi(department: Department, grade: DataGrade = DataGrade.O): DepartmentKpi {
    blockClassifiedData(grade);
    const list = Array.from(this.employees.values()).filter(e => e.department === department);
    if (list.length === 0) {
      return {
        department, headcount: 0, avgPerformance: 0, avgTenure: 0, turnoverRiskScore: 0,
      };
    }
    const avgPerf = list.reduce((a, e) => a + e.performanceScore, 0) / list.length;
    const avgTenure = list.reduce((a, e) => a + (this.currentYear - e.hireYear), 0) / list.length;
    const avgRisk = list.reduce((a, e) => a + this.riskScore(e), 0) / list.length;

    const kpi: DepartmentKpi = {
      department,
      headcount: list.length,
      avgPerformance: Math.round(avgPerf * 10) / 10,
      avgTenure: Math.round(avgTenure * 10) / 10,
      turnoverRiskScore: Math.round(avgRisk * 10) / 10,
    };
    this.log('COMPUTE_KPI', { department, headcount: kpi.headcount });
    return kpi;
  }

  // Plan SC: FR-R614.4
  identifyHighRiskEmployees(threshold: number = 60): string[] {
    const result: string[] = [];
    for (const e of this.employees.values()) {
      if (this.riskScore(e) >= threshold) result.push(e.id);
    }
    this.log('IDENTIFY_HIGH_RISK', { count: result.length, threshold });
    return result;
  }

  // Plan SC: FR-R614.5
  getEmployeeRisk(id: string): number | undefined {
    const emp = this.employees.get(id);
    if (!emp) return undefined;
    return this.riskScore(emp);
  }

  getAuditLog(): readonly AuditEntry[] {
    return this.audit;
  }
}
