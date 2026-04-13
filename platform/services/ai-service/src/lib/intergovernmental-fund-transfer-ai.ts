// SVC-AI-ADV-R470 Intergovernmental Fund Transfer AI
// Design Ref: SVC-AI-ADV-R470.design.md
// Plan SC: FR-470.1~6
// CSAP D-06 / N2SF N-05

export type DataGrade = 'O' | 'C' | 'S';

export interface Account {
  readonly agency: string;
  balance: number;
  readonly dailyLimit: number;
  usedToday: number;
}

export interface TransferRequest {
  readonly from: string;
  readonly to: string;
  readonly amount: number;
  readonly approvalCode: string;
}

export interface TransferResult {
  readonly success: boolean;
  readonly reason?: string;
  readonly newFromBalance: number;
  readonly newToBalance: number;
}

interface AuditEntry {
  readonly timestamp: string;
  readonly action: string;
  readonly details: Record<string, unknown>;
}

const APPROVAL_PATTERN = /^APR-\d{6}$/;

export class IntergovernmentalFundTransferAi {
  private readonly auditLog: AuditEntry[] = [];

  process(
    req: TransferRequest,
    fromAcct: Account,
    toAcct: Account,
    grade: DataGrade = 'O',
  ): TransferResult {
    if (grade === 'C' || grade === 'S') {
      throw new Error(`N2SF_BLOCKED: ${grade}등급 자금 데이터 차단 (N2SF N-05)`);
    }

    const fail = (reason: string): TransferResult => {
      this.auditLog.push({
        timestamp: new Date().toISOString(),
        action: 'FUND_TRANSFER',
        details: { success: false, reason, from: req.from, to: req.to },
      });
      return {
        success: false,
        reason,
        newFromBalance: fromAcct.balance,
        newToBalance: toAcct.balance,
      };
    };

    if (req.amount <= 0) return fail('amount must be > 0');
    if (!APPROVAL_PATTERN.test(req.approvalCode)) return fail('invalid approval code');
    if (fromAcct.balance < req.amount) return fail('insufficient balance');
    if (fromAcct.usedToday + req.amount > fromAcct.dailyLimit) {
      return fail('daily limit exceeded');
    }

    fromAcct.balance -= req.amount;
    fromAcct.usedToday += req.amount;
    toAcct.balance += req.amount;

    this.auditLog.push({
      timestamp: new Date().toISOString(),
      action: 'FUND_TRANSFER',
      details: { success: true, amount: req.amount, from: req.from, to: req.to },
    });

    return {
      success: true,
      newFromBalance: fromAcct.balance,
      newToBalance: toAcct.balance,
    };
  }

  getAuditLog(): readonly AuditEntry[] {
    return [...this.auditLog];
  }
}
