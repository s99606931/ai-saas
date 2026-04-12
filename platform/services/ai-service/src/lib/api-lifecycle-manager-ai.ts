// Design Ref: §핵심 알고리즘 — 상태 전환 + deprecated 잔여일 계산
// Plan SC: FR-R283.1~5

enum DataGrade { C = 'C', S = 'S', O = 'O' }

type ApiStatus = 'active' | 'deprecated' | 'retired';

interface ApiRecord {
  id: string;
  name: string;
  version: string;
  service: string;
  status: ApiStatus;
  deprecatedAt?: string;
  retirementDate?: string;
}

interface DeprecatedApiInfo {
  id: string;
  name: string;
  version: string;
  service: string;
  deprecatedAt: string;
  retirementDate?: string;
  daysUntilRetirement: number | null;
}

interface MigrationRecommendation {
  fromApiId: string;
  fromApiName: string;
  toApiId: string;
  toApiName: string;
  urgency: 'immediate' | 'soon' | 'planned';
}

interface AuditEntry {
  timestamp: string;
  action: string;
  details: Record<string, unknown>;
}

// Plan SC: FR-R283.5
function guardDataGrade(grade: DataGrade): void {
  if (grade === DataGrade.C || grade === DataGrade.S) {
    throw new Error(`BLOCKED: ${grade}등급 데이터는 AI API 전송 금지 (N2SF N-05)`);
  }
}

export class ApiLifecycleManagerAI {
  private apis = new Map<string, ApiRecord>();
  private auditLog: AuditEntry[] = [];

  private log(action: string, details: Record<string, unknown>): void {
    this.auditLog.push({ timestamp: new Date().toISOString(), action, details });
  }

  // Plan SC: FR-R283.1
  registerApi(id: string, name: string, version: string, service: string, status: ApiStatus = 'active'): void {
    this.apis.set(id, { id, name, version, service, status });
    this.log('REGISTER_API', { id, name, version, service, status });
  }

  // Plan SC: FR-R283.2
  transitionStatus(id: string, newStatus: ApiStatus, retirementDate?: string, grade: DataGrade = DataGrade.O): void {
    guardDataGrade(grade);
    const api = this.apis.get(id);
    if (!api) throw new Error(`API 미등록: ${id}`);
    api.status = newStatus;
    if (newStatus === 'deprecated') {
      api.deprecatedAt = new Date().toISOString();
      if (retirementDate) api.retirementDate = retirementDate;
    }
    this.log('TRANSITION_STATUS', { id, newStatus, retirementDate });
  }

  // Plan SC: FR-R283.3
  getDeprecatedApis(): DeprecatedApiInfo[] {
    const now = Date.now();
    return Array.from(this.apis.values())
      .filter(a => a.status === 'deprecated')
      .map(a => {
        const daysUntilRetirement = a.retirementDate
          ? Math.ceil((new Date(a.retirementDate).getTime() - now) / 86400000)
          : null;
        return {
          id: a.id,
          name: a.name,
          version: a.version,
          service: a.service,
          deprecatedAt: a.deprecatedAt ?? '',
          retirementDate: a.retirementDate,
          daysUntilRetirement,
        };
      });
  }

  // Plan SC: FR-R283.4
  getMigrationTargets(): MigrationRecommendation[] {
    const recommendations: MigrationRecommendation[] = [];
    const deprecatedApis = Array.from(this.apis.values()).filter(a => a.status === 'deprecated' || a.status === 'retired');
    const activeApis = Array.from(this.apis.values()).filter(a => a.status === 'active');

    for (const deprecated of deprecatedApis) {
      const target = activeApis.find(a => a.service === deprecated.service && a.id !== deprecated.id);
      if (target) {
        const urgency: 'immediate' | 'soon' | 'planned' = deprecated.status === 'retired' ? 'immediate' : 'soon';
        recommendations.push({
          fromApiId: deprecated.id,
          fromApiName: deprecated.name,
          toApiId: target.id,
          toApiName: target.name,
          urgency,
        });
      }
    }
    return recommendations;
  }

  // Plan SC: FR-R283.5
  getAuditLog(): AuditEntry[] {
    return [...this.auditLog];
  }
}
