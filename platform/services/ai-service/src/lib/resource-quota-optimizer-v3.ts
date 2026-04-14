// Design Ref: SVC-AI-ADV-R644.design.md §설계결정
// Plan SC: FR-R644.1~5
// 트랙 B 23차

interface NamespaceRecord { ns: string; quota: number }
interface AuditEntry { timestamp: string; action: string; details?: Record<string, unknown> }

export class ResourceQuotaOptimizerV3 {
  private namespaces = new Map<string, NamespaceRecord>();
  private usage = new Map<string, number[]>();
  private auditLog: AuditEntry[] = [];

  registerNamespace(ns: string, quota: number): void {
    this.namespaces.set(ns, { ns, quota });
    if (!this.usage.has(ns)) this.usage.set(ns, []);
    this.auditLog.push({
      timestamp: new Date().toISOString(),
      action: 'REGISTER_NS',
      details: { ns, quota },
    });
  }

  recordUsage(ns: string, amount: number, dataGrade?: string): void {
    if (dataGrade === 'C' || dataGrade === 'S') {
      throw new Error(`BLOCKED: ${dataGrade}등급 데이터는 AI API 전송 금지 (N2SF N-05)`);
    }
    const list = this.usage.get(ns) ?? [];
    list.push(amount);
    this.usage.set(ns, list);
    this.auditLog.push({
      timestamp: new Date().toISOString(),
      action: 'RECORD_USAGE',
      details: { ns, amount },
    });
  }

  getUtilization(ns: string): number {
    const record = this.namespaces.get(ns);
    if (!record || record.quota === 0) return 0;
    const list = this.usage.get(ns) ?? [];
    const total = list.reduce((acc, v) => acc + v, 0);
    return total / record.quota;
  }

  getOverLimitNamespaces(): NamespaceRecord[] {
    return Array.from(this.namespaces.values()).filter((n) => this.getUtilization(n.ns) >= 1.0);
  }

  getAuditLog(): AuditEntry[] {
    return [...this.auditLog];
  }
}
