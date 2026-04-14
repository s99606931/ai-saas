// Design Ref: §SVC-AI-ADV-R518 — AI기반 멀티테넌트 리소스 공정성 검증
// Plan SC: FR-R518.1~5

export type FairnessStatus = 'OVER_QUOTA' | 'UNDER_UTILIZED' | 'FAIR';

export interface TenantResource {
  readonly tenantId: string;
  readonly cpuAlloc: number;
  readonly memAllocGB: number;
  readonly storageGB: number;
  readonly quota: { readonly cpu: number; readonly mem: number; readonly storage: number };
}

export interface TenantFairness {
  readonly tenantId: string;
  readonly cpuStatus: FairnessStatus;
  readonly memStatus: FairnessStatus;
  readonly storageStatus: FairnessStatus;
  readonly overallStatus: FairnessStatus;
}

export interface FairnessReport {
  readonly tenants: readonly TenantFairness[];
  readonly fairnessScore: number;
}

interface AuditEvent {
  timestamp: string;
  action: string;
  details: Record<string, unknown>;
}

function classify(actual: number, quota: number): FairnessStatus {
  if (quota === 0) return 'FAIR';
  const rate = (actual / quota) * 100;
  if (rate > 110) return 'OVER_QUOTA';
  if (rate < 10) return 'UNDER_UTILIZED';
  return 'FAIR';
}

export class MultitenantResourceFairnessVerifier {
  private readonly auditLog: AuditEvent[] = [];

  verify(tenants: readonly TenantResource[]): FairnessReport {
    const tenantResults: TenantFairness[] = tenants.map(t => {
      const cpuStatus = classify(t.cpuAlloc, t.quota.cpu);
      const memStatus = classify(t.memAllocGB, t.quota.mem);
      const storageStatus = classify(t.storageGB, t.quota.storage);

      const overallStatus: FairnessStatus =
        cpuStatus === 'OVER_QUOTA' || memStatus === 'OVER_QUOTA' || storageStatus === 'OVER_QUOTA'
          ? 'OVER_QUOTA'
          : cpuStatus === 'UNDER_UTILIZED' ||
            memStatus === 'UNDER_UTILIZED' ||
            storageStatus === 'UNDER_UTILIZED'
          ? 'UNDER_UTILIZED'
          : 'FAIR';

      return { tenantId: t.tenantId, cpuStatus, memStatus, storageStatus, overallStatus };
    });

    const fairCount = tenantResults.filter(r => r.overallStatus === 'FAIR').length;
    const fairnessScore =
      tenants.length === 0 ? 100 : Math.round((fairCount / tenants.length) * 100);

    this.auditLog.push({
      timestamp: new Date().toISOString(),
      action: 'fairness.verify',
      details: {
        tenantCount: tenants.length,
        overQuotaCount: tenantResults.filter(r => r.overallStatus === 'OVER_QUOTA').length,
        fairnessScore,
      },
    });

    return { tenants: tenantResults, fairnessScore };
  }

  getAuditLog(): readonly AuditEvent[] {
    return [...this.auditLog];
  }
}
