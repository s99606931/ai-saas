// Design Ref: §변경필요 — current!==recommended, risk: impact>=8:HIGH/>=5:MEDIUM/LOW
// Plan SC: SC-R602-1, SC-R602-2, SC-R602-3

interface MeshPolicy {
  policyId: string;
  type: 'RETRY' | 'TIMEOUT' | 'CIRCUIT_BREAKER' | 'RATE_LIMIT';
  currentValue: number;
  recommendedValue: number;
  impactScore: number;
}

type PolicyRisk = 'HIGH' | 'MEDIUM' | 'LOW';

interface PolicyDetail {
  policyId: string;
  needsChange: boolean;
  risk: PolicyRisk;
}

interface PolicyOptResult {
  meshId: string;
  optimizationScore: number;
  policies: PolicyDetail[];
  changesRequired: number;
}

interface AuditEntry {
  timestamp: string;
  action: string;
  meshId: string;
  optimizationScore: number;
  changesRequired: number;
}

export class ServiceMeshPolicyOptimizerV2 {
  private readonly auditLog: AuditEntry[] = [];

  optimize(meshId: string, policies: MeshPolicy[]): PolicyOptResult {
    const details: PolicyDetail[] = policies.map((p) => ({
      policyId: p.policyId,
      needsChange: p.currentValue !== p.recommendedValue,
      risk: this.classifyRisk(p.impactScore),
    }));

    const changesRequired = details.filter((d) => d.needsChange).length;
    const noChangeCount = details.filter((d) => !d.needsChange).length;
    const optimizationScore = policies.length > 0
      ? Math.round((noChangeCount / policies.length) * 100 * 100) / 100
      : 100;

    this.auditLog.push({
      timestamp: new Date().toISOString(),
      action: 'MESH_POLICY_OPTIMIZED',
      meshId,
      optimizationScore,
      changesRequired,
    });

    return { meshId, optimizationScore, policies: details, changesRequired };
  }

  private classifyRisk(impactScore: number): PolicyRisk {
    if (impactScore >= 8) return 'HIGH';
    if (impactScore >= 5) return 'MEDIUM';
    return 'LOW';
  }

  getAuditLog(): AuditEntry[] {
    return [...this.auditLog];
  }
}
