// Design Ref: SVC-AI-ADV-R638.design.md §설계결정
// Plan SC: FR-R638.1~5
// 트랙 B 23차

interface DeptRecord { deptId: string; budget: number }
interface AuditEntry { timestamp: string; action: string; details?: Record<string, unknown> }

export class PublicCloudCostAllocatorV2 {
  private departments = new Map<string, DeptRecord>();
  private usage = new Map<string, number[]>();
  private auditLog: AuditEntry[] = [];

  registerDepartment(deptId: string, budget: number): void {
    this.departments.set(deptId, { deptId, budget });
    if (!this.usage.has(deptId)) this.usage.set(deptId, []);
    this.auditLog.push({
      timestamp: new Date().toISOString(),
      action: 'REGISTER_DEPT',
      details: { deptId, budget },
    });
  }

  recordUsage(deptId: string, amount: number, dataGrade?: string): void {
    if (dataGrade === 'C' || dataGrade === 'S') {
      throw new Error(`BLOCKED: ${dataGrade}등급 데이터는 AI API 전송 금지 (N2SF N-05)`);
    }
    const list = this.usage.get(deptId) ?? [];
    list.push(amount);
    this.usage.set(deptId, list);
    this.auditLog.push({
      timestamp: new Date().toISOString(),
      action: 'RECORD_USAGE',
      details: { deptId, amount },
    });
  }

  getAllocation(deptId: string): number {
    const list = this.usage.get(deptId) ?? [];
    return list.reduce((acc, v) => acc + v, 0);
  }

  getOverBudgetDepartments(): DeptRecord[] {
    return Array.from(this.departments.values()).filter(
      (d) => this.getAllocation(d.deptId) > d.budget,
    );
  }

  getAuditLog(): AuditEntry[] {
    return [...this.auditLog];
  }
}
