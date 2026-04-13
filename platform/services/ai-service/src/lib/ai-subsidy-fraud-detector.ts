// SVC-AI-ADV-R499 AI Subsidy Fraud Detector
// Design Ref: SVC-AI-ADV-R499.design.md §보조금부정수급탐지
// Plan SC: FR-499.1~6
// CSAP D-06 / N2SF N-05 / 보조금법

export type DataGrade = 'O' | 'C' | 'S';

const DATA_GRADE_BLOCK = ['C', 'S'] as const;

function blockClassifiedData(grade: DataGrade): void {
  if ((DATA_GRADE_BLOCK as readonly string[]).includes(grade)) {
    throw new Error(`BLOCKED: ${grade}등급 데이터는 AI API 전송 금지 (N2SF N-05)`);
  }
}

export type SubsidyType =
  | 'employment'
  | 'agriculture'
  | 'startup'
  | 'welfare'
  | 'rnd'
  | 'environment';

export interface SubsidyApplication {
  readonly applicationId: string;
  readonly applicantHashId: string;
  readonly subsidyType: SubsidyType;
  readonly requestedAmountKrw: number;
  readonly previousReceivedCount: number;
  readonly hasMultipleAccounts: boolean;
  readonly addressMatchesBusinessRegistry: boolean;
  readonly documentsConsistent: boolean;
  readonly relatedPartyTransactions: number;
}

export interface FraudAssessment {
  readonly applicationId: string;
  readonly fraudProbability: number;
  readonly riskFactors: readonly string[];
  readonly action: 'auto_approve' | 'manual_review' | 'investigate' | 'reject';
  readonly suggestedAuditDepth: 'light' | 'standard' | 'deep';
}

interface AuditEntry {
  readonly timestamp: string;
  readonly action: string;
  readonly detail: Record<string, unknown>;
}

const HIGH_AMOUNT_THRESHOLD_KRW = 50_000_000;

export class AiSubsidyFraudDetector {
  private readonly auditLog: AuditEntry[] = [];
  private readonly receivedHistory: Map<string, number> = new Map();

  recordReceipt(applicantHashId: string): void {
    const cur = this.receivedHistory.get(applicantHashId) ?? 0;
    this.receivedHistory.set(applicantHashId, cur + 1);
    this.appendAudit('RECORD_RECEIPT', { applicantHashId, count: cur + 1 });
  }

  assess(app: SubsidyApplication, grade: DataGrade = 'O'): FraudAssessment {
    blockClassifiedData(grade);

    const riskFactors: string[] = [];
    let prob = 0;

    if (app.hasMultipleAccounts) {
      riskFactors.push('multiple_accounts');
      prob += 0.25;
    }
    if (!app.addressMatchesBusinessRegistry) {
      riskFactors.push('address_mismatch');
      prob += 0.2;
    }
    if (!app.documentsConsistent) {
      riskFactors.push('inconsistent_documents');
      prob += 0.3;
    }
    if (app.relatedPartyTransactions > 3) {
      riskFactors.push('related_party_transactions');
      prob += 0.15;
    }
    if (app.previousReceivedCount >= 3) {
      riskFactors.push('frequent_recipient');
      prob += 0.1;
    }
    if (app.requestedAmountKrw >= HIGH_AMOUNT_THRESHOLD_KRW) {
      riskFactors.push('high_amount');
      prob += 0.1;
    }

    const cumulativeReceived = this.receivedHistory.get(app.applicantHashId) ?? 0;
    if (cumulativeReceived >= 5) {
      riskFactors.push('chronic_recipient');
      prob += 0.15;
    }

    prob = Math.min(1, Math.round(prob * 100) / 100);

    let action: FraudAssessment['action'] = 'auto_approve';
    let suggestedAuditDepth: FraudAssessment['suggestedAuditDepth'] = 'light';
    if (prob >= 0.7) {
      action = 'reject';
      suggestedAuditDepth = 'deep';
    } else if (prob >= 0.4) {
      action = 'investigate';
      suggestedAuditDepth = 'deep';
    } else if (prob >= 0.2) {
      action = 'manual_review';
      suggestedAuditDepth = 'standard';
    }

    const result: FraudAssessment = {
      applicationId: app.applicationId,
      fraudProbability: prob,
      riskFactors,
      action,
      suggestedAuditDepth,
    };

    this.appendAudit('ASSESS', {
      applicationId: app.applicationId,
      probability: prob,
      action,
    });
    return result;
  }

  totalApplicantsTracked(): number {
    return this.receivedHistory.size;
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
