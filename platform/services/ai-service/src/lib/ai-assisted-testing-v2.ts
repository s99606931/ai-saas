// Design Ref: SVC-AI-ADV-R642.design.md §설계결정
// Plan SC: FR-R642.1~5
// 트랙 B 23차

interface TestCase { testId: string; module: string }
interface AuditEntry { timestamp: string; action: string; details?: Record<string, unknown> }

export class AiAssistedTestingV2 {
  private tests = new Map<string, TestCase>();
  private results = new Map<string, Array<'pass' | 'fail'>>();
  private auditLog: AuditEntry[] = [];

  registerTest(testId: string, module: string): void {
    this.tests.set(testId, { testId, module });
    if (!this.results.has(testId)) this.results.set(testId, []);
    this.auditLog.push({
      timestamp: new Date().toISOString(),
      action: 'REGISTER_TEST',
      details: { testId, module },
    });
  }

  recordResult(testId: string, status: 'pass' | 'fail', dataGrade?: string): void {
    if (dataGrade === 'C' || dataGrade === 'S') {
      throw new Error(`BLOCKED: ${dataGrade}등급 데이터는 AI API 전송 금지 (N2SF N-05)`);
    }
    const list = this.results.get(testId) ?? [];
    list.push(status);
    this.results.set(testId, list);
    this.auditLog.push({
      timestamp: new Date().toISOString(),
      action: 'RECORD_RESULT',
      details: { testId, status },
    });
  }

  getModulePassRate(module: string): number {
    const moduleTests = Array.from(this.tests.values()).filter((t) => t.module === module);
    let pass = 0;
    let total = 0;
    for (const t of moduleTests) {
      const list = this.results.get(t.testId) ?? [];
      for (const r of list) {
        total += 1;
        if (r === 'pass') pass += 1;
      }
    }
    if (total === 0) return 0;
    return pass / total;
  }

  getWeakModules(threshold: number): string[] {
    const modules = new Set<string>();
    for (const t of this.tests.values()) modules.add(t.module);
    return Array.from(modules).filter((m) => this.getModulePassRate(m) < threshold);
  }

  getAuditLog(): AuditEntry[] {
    return [...this.auditLog];
  }
}
