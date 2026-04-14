// Design Ref: SVC-AI-ADV-R676.design.md — AI기반 공급망 리스크 분석 v2
// Plan SC: FR-R676.1~5

export type SupplyRiskLevel = 'HIGH' | 'MEDIUM' | 'LOW';
export type SupplyAction = 'ACCEPT' | 'MONITOR' | 'REPLACE';

interface Vendor { vendorId: string; name: string; criticality: 'HIGH' | 'MEDIUM' | 'LOW' }
interface RiskSignal {
  signalId: string;
  vendorId: string;
  riskScore: number;
}
interface RiskAssessment {
  signalId: string;
  vendorId: string;
  level: SupplyRiskLevel;
  action: SupplyAction;
}
interface AuditEntry { timestamp: string; action: string; details?: Record<string, unknown> }

const ACTION_RANK: SupplyAction[] = ['ACCEPT', 'MONITOR', 'REPLACE'];

function rankToAction(rank: number): SupplyAction {
  const idx = Math.max(0, Math.min(ACTION_RANK.length - 1, rank));
  return ACTION_RANK[idx]!;
}

export class SupplyChainRiskAIV2 {
  private vendors = new Map<string, Vendor>();
  private assessments: RiskAssessment[] = [];
  private auditLog: AuditEntry[] = [];

  registerVendor(vendor: Vendor): void {
    this.vendors.set(vendor.vendorId, vendor);
    this.auditLog.push({
      timestamp: new Date().toISOString(),
      action: 'REGISTER_VENDOR',
      details: { vendorId: vendor.vendorId, name: vendor.name, criticality: vendor.criticality },
    });
  }

  assessRisk(signal: RiskSignal, dataGrade?: string): RiskAssessment {
    if (dataGrade === 'C' || dataGrade === 'S') {
      throw new Error(`BLOCKED: ${dataGrade}등급 AI API 전송 금지 (N2SF N-05)`);
    }
    const vendor = this.vendors.get(signal.vendorId);
    if (!vendor) {
      throw new Error(`UNKNOWN_VENDOR: ${signal.vendorId}`);
    }
    if (signal.riskScore < 0 || signal.riskScore > 100) {
      throw new Error('INVALID_RISK_SCORE');
    }

    let level: SupplyRiskLevel;
    let baseRank: number;
    if (signal.riskScore >= 70) {
      level = 'HIGH';
      baseRank = 2;
    } else if (signal.riskScore >= 40) {
      level = 'MEDIUM';
      baseRank = 1;
    } else {
      level = 'LOW';
      baseRank = 0;
    }

    const finalRank = vendor.criticality === 'HIGH' ? baseRank + 1 : baseRank;
    const action = rankToAction(finalRank);

    const assessment: RiskAssessment = {
      signalId: signal.signalId,
      vendorId: signal.vendorId,
      level,
      action,
    };
    this.assessments.push(assessment);
    this.auditLog.push({
      timestamp: new Date().toISOString(),
      action: 'ASSESS_RISK',
      details: { signalId: signal.signalId, vendorId: signal.vendorId, level, action },
    });
    return assessment;
  }

  getReplaceCandidates(): RiskAssessment[] {
    return this.assessments.filter((a) => a.action === 'REPLACE');
  }

  getAuditLog(): AuditEntry[] {
    return [...this.auditLog];
  }
}
