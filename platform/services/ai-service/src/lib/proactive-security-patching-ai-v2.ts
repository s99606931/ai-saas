// Design Ref: SVC-AI-ADV-R654.design.md — AI기반 선제적 보안 패치 v2
// Plan SC: FR-R654.1~5

export type Severity = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
export type PatchAction = 'IMMEDIATE' | 'SCHEDULED' | 'MONITOR';

interface Asset { assetId: string; component: string; version: string }
interface Vulnerability {
  vulnId: string;
  assetId: string;
  cvss: number;
  exploitAvailable: boolean;
}
interface PatchPlan {
  vulnId: string;
  assetId: string;
  severity: Severity;
  action: PatchAction;
}
interface AuditEntry { timestamp: string; action: string; details?: Record<string, unknown> }

const ACTION_RANK: PatchAction[] = ['MONITOR', 'SCHEDULED', 'IMMEDIATE'];

function rankToAction(rank: number): PatchAction {
  const idx = Math.max(0, Math.min(ACTION_RANK.length - 1, rank));
  return ACTION_RANK[idx]!;
}

export class ProactiveSecurityPatchingAIV2 {
  private assets = new Map<string, Asset>();
  private plans: PatchPlan[] = [];
  private auditLog: AuditEntry[] = [];

  registerAsset(asset: Asset): void {
    this.assets.set(asset.assetId, asset);
    this.auditLog.push({
      timestamp: new Date().toISOString(),
      action: 'REGISTER_ASSET',
      details: { assetId: asset.assetId, component: asset.component, version: asset.version },
    });
  }

  reportVulnerability(vuln: Vulnerability, dataGrade?: string): PatchPlan {
    if (dataGrade === 'C' || dataGrade === 'S') {
      throw new Error(`BLOCKED: ${dataGrade}등급 AI API 전송 금지 (N2SF N-05)`);
    }
    if (!this.assets.has(vuln.assetId)) {
      throw new Error(`UNKNOWN_ASSET: ${vuln.assetId}`);
    }
    if (vuln.cvss < 0 || vuln.cvss > 10) {
      throw new Error('INVALID_CVSS');
    }

    let severity: Severity;
    let baseRank: number;
    if (vuln.cvss >= 9.0) {
      severity = 'CRITICAL';
      baseRank = 2;
    } else if (vuln.cvss >= 7.0) {
      severity = 'HIGH';
      baseRank = 2;
    } else if (vuln.cvss >= 4.0) {
      severity = 'MEDIUM';
      baseRank = 1;
    } else {
      severity = 'LOW';
      baseRank = 0;
    }

    const finalRank = vuln.exploitAvailable ? baseRank + 1 : baseRank;
    const action = rankToAction(finalRank);

    const plan: PatchPlan = { vulnId: vuln.vulnId, assetId: vuln.assetId, severity, action };
    this.plans.push(plan);
    this.auditLog.push({
      timestamp: new Date().toISOString(),
      action: 'REPORT_VULN',
      details: { vulnId: vuln.vulnId, assetId: vuln.assetId, cvss: vuln.cvss, severity, action },
    });
    return plan;
  }

  getImmediatePatches(): PatchPlan[] {
    return this.plans.filter((p) => p.action === 'IMMEDIATE');
  }

  getAuditLog(): AuditEntry[] {
    return [...this.auditLog];
  }
}
