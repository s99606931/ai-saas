// SVC-AI-ADV-R358 AI Ethics Compliance Checker
// Design Ref: SVC-AI-ADV-R358.design.md
// Plan SC: SC-R358-1~4
// CSAP: D-06 감사, N2SF N-05

export type DataGrade = 'O' | 'C' | 'S';

export type EuRiskLevel = 'unacceptable' | 'high' | 'limited' | 'minimal';

export interface KcaChecklist {
  readonly humanCentered: boolean;
  readonly fairness: boolean;
  readonly transparency: boolean;
  readonly accountability: boolean;
  readonly privacy: boolean;
  readonly safety: boolean;
  readonly dataGovernance: boolean;
  readonly publicInterest: boolean;
  readonly sustainability: boolean;
  readonly continuousImprovement: boolean;
}

export interface AiSystem {
  readonly id: string;
  readonly purpose: string;
  readonly grade: DataGrade;
  readonly checklist: KcaChecklist;
}

export interface ComplianceReport {
  readonly systemId: string;
  readonly euRisk: EuRiskLevel;
  readonly kcaScore: number;
  readonly compliant: boolean;
  readonly violations: readonly string[];
}

export interface AuditEntry {
  readonly timestamp: string;
  readonly action: string;
  readonly target: string;
  readonly details: Record<string, unknown>;
}

const UNACCEPTABLE = ['biometric_id', 'social_scoring', 'mass_surveillance'];
const HIGH = ['recruitment', 'credit_scoring', 'education', 'law_enforcement', 'critical_infra'];
const LIMITED = ['chatbot', 'emotion', 'content_generation'];

export class AiEthicsComplianceChecker {
  private readonly auditLog: AuditEntry[] = [];

  check(system: AiSystem): ComplianceReport {
    if (system.grade === 'C' || system.grade === 'S') {
      throw new Error(`N2SF_BLOCKED: ${system.grade}등급 AI 시스템 정보 차단 (N2SF N-05)`);
    }
    const euRisk = this.classifyEuRisk(system.purpose);

    const entries = Object.entries(system.checklist) as Array<[keyof KcaChecklist, boolean]>;
    const trueCount = entries.filter(([, v]) => v).length;
    const kcaScore = Number((trueCount / entries.length).toFixed(4));
    const violations = entries.filter(([, v]) => !v).map(([k]) => String(k));

    const compliant = euRisk !== 'unacceptable' && kcaScore >= 0.7;

    const report: ComplianceReport = {
      systemId: system.id,
      euRisk,
      kcaScore,
      compliant,
      violations,
    };

    this.record('CHECK', system.id, {
      euRisk,
      kcaScore,
      compliant,
      violationCount: violations.length,
    });

    return report;
  }

  getAuditLog(): readonly AuditEntry[] {
    return this.auditLog;
  }

  private classifyEuRisk(purpose: string): EuRiskLevel {
    const lower = purpose.toLowerCase();
    if (UNACCEPTABLE.some((k) => lower.includes(k))) return 'unacceptable';
    if (HIGH.some((k) => lower.includes(k))) return 'high';
    if (LIMITED.some((k) => lower.includes(k))) return 'limited';
    return 'minimal';
  }

  private record(action: string, target: string, details: Record<string, unknown>): void {
    this.auditLog.push({
      timestamp: new Date().toISOString(),
      action,
      target,
      details,
    });
  }
}
