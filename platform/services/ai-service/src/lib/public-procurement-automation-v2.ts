// Design Ref: §조달방식 — isEmergency:EMERGENCY / >50M:OPEN_BID / >10M:LIMITED_BID / DIRECT
// Plan SC: SC-R569-1, SC-R569-2, SC-R569-3

interface ProcurementInput {
  procurementId: string;
  itemCategory: string;
  estimatedAmount: number;
  vendorCount: number;
  isEmergency: boolean;
  budgetAvailable: number;
}

type ProcurementMethod = 'EMERGENCY_PURCHASE' | 'OPEN_BID' | 'LIMITED_BID' | 'DIRECT_CONTRACT';

interface ProcurementResult {
  procurementId: string;
  canAutoApprove: boolean;
  procurementMethod: ProcurementMethod;
  budgetMarginRate: number;
}

interface AuditEntry {
  timestamp: string;
  action: string;
  procurementId: string;
  procurementMethod: ProcurementMethod;
  canAutoApprove: boolean;
}

export class PublicProcurementAutomationV2 {
  private readonly auditLog: AuditEntry[] = [];

  process(input: ProcurementInput): ProcurementResult {
    const { procurementId, estimatedAmount, vendorCount, isEmergency, budgetAvailable } = input;

    const canAutoApprove = estimatedAmount <= budgetAvailable * 0.1 && vendorCount >= 3 && !isEmergency;
    const procurementMethod = this.determineMethod(estimatedAmount, isEmergency);
    const budgetMarginRate = Math.round(((budgetAvailable - estimatedAmount) / budgetAvailable) * 100 * 10) / 10;

    this.auditLog.push({
      timestamp: new Date().toISOString(),
      action: 'PROCUREMENT_PROCESSED',
      procurementId,
      procurementMethod,
      canAutoApprove,
    });

    return { procurementId, canAutoApprove, procurementMethod, budgetMarginRate };
  }

  private determineMethod(amount: number, isEmergency: boolean): ProcurementMethod {
    if (isEmergency) return 'EMERGENCY_PURCHASE';
    if (amount > 50_000_000) return 'OPEN_BID';
    if (amount > 10_000_000) return 'LIMITED_BID';
    return 'DIRECT_CONTRACT';
  }

  getAuditLog(): AuditEntry[] {
    return [...this.auditLog];
  }
}
