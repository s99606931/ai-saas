// Design Ref: SVC-AI-ADV-R643.design.md §설계결정
// Plan SC: FR-R643.1~5
// 트랙 B 23차

interface ContractRecord { contractId: string; vendor: string }
interface AuditEntry { timestamp: string; action: string; details?: Record<string, unknown> }

export class ContractComplianceCheckerV3 {
  private contracts = new Map<string, ContractRecord>();
  private results = new Map<string, boolean[]>();
  private auditLog: AuditEntry[] = [];

  registerContract(contractId: string, vendor: string): void {
    this.contracts.set(contractId, { contractId, vendor });
    if (!this.results.has(contractId)) this.results.set(contractId, []);
    this.auditLog.push({
      timestamp: new Date().toISOString(),
      action: 'REGISTER_CONTRACT',
      details: { contractId, vendor },
    });
  }

  checkCondition(contractId: string, satisfied: boolean, dataGrade?: string): void {
    if (dataGrade === 'C' || dataGrade === 'S') {
      throw new Error(`BLOCKED: ${dataGrade}등급 데이터는 AI API 전송 금지 (N2SF N-05)`);
    }
    const list = this.results.get(contractId) ?? [];
    list.push(satisfied);
    this.results.set(contractId, list);
    this.auditLog.push({
      timestamp: new Date().toISOString(),
      action: 'CHECK_CONDITION',
      details: { contractId, satisfied },
    });
  }

  getComplianceRate(contractId: string): number {
    const list = this.results.get(contractId) ?? [];
    if (list.length === 0) return 0;
    const pass = list.filter((r) => r).length;
    return pass / list.length;
  }

  getNonCompliantContracts(threshold = 1.0): ContractRecord[] {
    return Array.from(this.contracts.values()).filter(
      (c) => this.getComplianceRate(c.contractId) < threshold,
    );
  }

  getAuditLog(): AuditEntry[] {
    return [...this.auditLog];
  }
}
