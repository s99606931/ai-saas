// SVC-AI-ADV-R497 Government Contract Compliance AI
// Design Ref: SVC-AI-ADV-R497.design.md §정부계약준수
// Plan SC: FR-497.1~6
// CSAP D-06 / N2SF N-05 / 국가계약법

export type DataGrade = 'O' | 'C' | 'S';

const DATA_GRADE_BLOCK = ['C', 'S'] as const;

function blockClassifiedData(grade: DataGrade): void {
  if ((DATA_GRADE_BLOCK as readonly string[]).includes(grade)) {
    throw new Error(`BLOCKED: ${grade}등급 데이터는 AI API 전송 금지 (N2SF N-05)`);
  }
}

export type ContractType = 'goods' | 'service' | 'construction' | 'lease' | 'consulting';
export type BiddingMethod = 'open' | 'limited' | 'designated' | 'private';

export interface GovContract {
  readonly contractId: string;
  readonly type: ContractType;
  readonly amountKrw: number;
  readonly biddingMethod: BiddingMethod;
  readonly competingBidders: number;
  readonly contractorRegistered: boolean;
  readonly performanceBondPct: number;
  readonly hasIntegrityPledge: boolean;
}

export interface ComplianceCheckResult {
  readonly contractId: string;
  readonly compliant: boolean;
  readonly violations: readonly string[];
  readonly riskScore: number;
  readonly recommendation: 'approve' | 'review' | 'reject';
}

interface AuditEntry {
  readonly timestamp: string;
  readonly action: string;
  readonly detail: Record<string, unknown>;
}

const OPEN_BIDDING_THRESHOLD_KRW = 200_000_000;
const MIN_BIDDERS_FOR_OPEN = 2;

export class GovContractComplianceAi {
  private readonly auditLog: AuditEntry[] = [];

  check(contract: GovContract, grade: DataGrade = 'O'): ComplianceCheckResult {
    blockClassifiedData(grade);

    const violations: string[] = [];
    let riskScore = 0;

    if (contract.amountKrw >= OPEN_BIDDING_THRESHOLD_KRW && contract.biddingMethod !== 'open') {
      violations.push('open_bidding_required');
      riskScore += 40;
    }
    if (contract.biddingMethod === 'open' && contract.competingBidders < MIN_BIDDERS_FOR_OPEN) {
      violations.push('insufficient_competition');
      riskScore += 25;
    }
    if (!contract.contractorRegistered) {
      violations.push('unregistered_contractor');
      riskScore += 30;
    }
    if (contract.performanceBondPct < 10) {
      violations.push('insufficient_performance_bond');
      riskScore += 15;
    }
    if (!contract.hasIntegrityPledge) {
      violations.push('missing_integrity_pledge');
      riskScore += 10;
    }
    if (contract.biddingMethod === 'private' && contract.amountKrw > 50_000_000) {
      violations.push('private_contract_over_threshold');
      riskScore += 35;
    }

    riskScore = Math.min(100, riskScore);

    let recommendation: ComplianceCheckResult['recommendation'] = 'approve';
    if (riskScore >= 50) recommendation = 'reject';
    else if (riskScore >= 20) recommendation = 'review';

    const result: ComplianceCheckResult = {
      contractId: contract.contractId,
      compliant: violations.length === 0,
      violations,
      riskScore,
      recommendation,
    };

    this.appendAudit('CHECK', {
      contractId: contract.contractId,
      violations: violations.length,
      recommendation,
    });
    return result;
  }

  batchCheck(contracts: readonly GovContract[]): readonly ComplianceCheckResult[] {
    return contracts.map((c) => this.check(c));
  }

  getAuditLog(): readonly AuditEntry[] {
    return [...this.auditLog];
  }

  private appendAudit(action: string, detail: Record<string, unknown>): void {
    this.auditLog.push({
      timestamp: new Date().toISOString(),
      action,
      detail,
    });
  }
}
