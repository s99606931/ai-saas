// Design Ref: §핵심 알고리즘 — 할당량 초과 탐지 + 테넌트 격리 검증
// Plan SC: FR-R247.1~5

enum DataGrade { C = 'C', S = 'S', O = 'O' }

type ResourceType = 'cpu' | 'memory' | 'storage';

interface ResourceQuota {
  cpu: number;
  memory: number;
  storage: number;
}

interface Tenant {
  id: string;
  name: string;
  quotas: ResourceQuota;
}

interface UsageRecord {
  tenantId: string;
  resourceType: ResourceType;
  amount: number;
  timestamp: string;
}

interface QuotaViolation {
  tenantId: string;
  resourceType: ResourceType;
  used: number;
  quota: number;
  overagePercent: number;
}

interface IsolationReport {
  totalTenants: number;
  violations: QuotaViolation[];
  isolationHealthy: boolean;
  summary: string;
}

interface AuditEntry {
  timestamp: string;
  action: string;
  details: Record<string, unknown>;
}

// Plan SC: FR-R247.5
function guardDataGrade(grade: DataGrade): void {
  if (grade === DataGrade.C || grade === DataGrade.S) {
    throw new Error(`BLOCKED: ${grade}등급 데이터는 AI API 전송 금지 (N2SF N-05)`);
  }
}

export class MultitenantResourceIsolationVerifier {
  private tenants = new Map<string, Tenant>();
  private usageRecords: UsageRecord[] = [];
  private auditLog: AuditEntry[] = [];

  private log(action: string, details: Record<string, unknown>): void {
    this.auditLog.push({ timestamp: new Date().toISOString(), action, details });
  }

  // Plan SC: FR-R247.1
  registerTenant(id: string, name: string, quotas: ResourceQuota): void {
    this.tenants.set(id, { id, name, quotas });
    this.log('REGISTER_TENANT', { id, name, quotas });
  }

  // Plan SC: FR-R247.2
  recordUsage(tenantId: string, resourceType: ResourceType, amount: number, grade: DataGrade = DataGrade.O): void {
    guardDataGrade(grade);
    if (!this.tenants.has(tenantId)) throw new Error(`테넌트 미등록: ${tenantId}`);
    this.usageRecords.push({ tenantId, resourceType, amount, timestamp: new Date().toISOString() });
    this.log('RECORD_USAGE', { tenantId, resourceType, amount });
  }

  private getTotalUsage(tenantId: string, resourceType: ResourceType): number {
    return this.usageRecords
      .filter(r => r.tenantId === tenantId && r.resourceType === resourceType)
      .reduce((s, r) => s + r.amount, 0);
  }

  // Plan SC: FR-R247.3
  checkQuotaViolations(tenantId: string): QuotaViolation[] {
    const tenant = this.tenants.get(tenantId);
    if (!tenant) throw new Error(`테넌트 미등록: ${tenantId}`);

    const violations: QuotaViolation[] = [];
    const resourceTypes: ResourceType[] = ['cpu', 'memory', 'storage'];

    for (const resourceType of resourceTypes) {
      const used = this.getTotalUsage(tenantId, resourceType);
      const quota = tenant.quotas[resourceType];
      if (used > quota) {
        const overagePercent = Math.round(((used - quota) / quota) * 100);
        violations.push({ tenantId, resourceType, used, quota, overagePercent });
      }
    }

    if (violations.length > 0) {
      this.log('QUOTA_VIOLATION', { tenantId, violationsCount: violations.length });
    }
    return violations;
  }

  // Plan SC: FR-R247.4
  verifyIsolation(): IsolationReport {
    const allViolations: QuotaViolation[] = [];

    for (const tenantId of this.tenants.keys()) {
      allViolations.push(...this.checkQuotaViolations(tenantId));
    }

    const isolationHealthy = allViolations.length === 0;
    const summary = isolationHealthy
      ? '모든 테넌트 리소스 격리 정상'
      : `${allViolations.length}건 할당량 초과 탐지`;

    this.log('VERIFY_ISOLATION', { totalTenants: this.tenants.size, violationsCount: allViolations.length });
    return { totalTenants: this.tenants.size, violations: allViolations, isolationHealthy, summary };
  }

  // Plan SC: FR-R247.5
  getAuditLog(): AuditEntry[] {
    return [...this.auditLog];
  }
}
