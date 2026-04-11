// 접근 권한 정기 검토 자동화 -- FR-N336.1~FR-N336.4
// Design Ref: MTU-N336 | CSAP: D-06, D-08

export interface UserAccess { readonly userId: string; readonly userName: string; readonly roles: readonly string[]; readonly lastLogin: string | null; readonly department: string; readonly createdAt: string; }
export interface AccessAnomaly { readonly anomalyId: string; readonly userId: string; readonly userName: string; readonly type: 'inactive' | 'over_privileged' | 'orphaned' | 'role_conflict'; readonly description: string; readonly severity: 'high' | 'medium' | 'low'; readonly recommendation: string; }
export interface ReviewCampaign { readonly campaignId: string; readonly tenantId: string; readonly name: string; readonly status: 'active' | 'completed' | 'expired'; readonly totalUsers: number; readonly anomalies: readonly AccessAnomaly[]; readonly startedAt: string; readonly completedAt: string | null; }
export interface AccessReviewAuditEntry { readonly timestamp: string; readonly actor: string; readonly tenantId: string; readonly action: string; readonly target: string; readonly details: Record<string, unknown>; }

const auditLog: AccessReviewAuditEntry[] = [];
function recordAudit(entry: Omit<AccessReviewAuditEntry, 'timestamp'>): void { auditLog.push({ ...entry, timestamp: new Date().toISOString() }); }
export function getAccessReviewAuditLog(tenantId: string): readonly AccessReviewAuditEntry[] { return auditLog.filter(e => e.tenantId === tenantId); }

const ADMIN_ROLES = ['super_admin', 'system_admin', 'security_admin'];
const CONFLICTING_ROLES: Record<string, string> = { 'approver': 'requester', 'auditor': 'operator' };

export function detectInactive(users: UserAccess[], inactiveDays: number = 90): AccessAnomaly[] {
  const cutoff = new Date(Date.now() - inactiveDays * 24 * 60 * 60 * 1000);
  return users.filter(u => !u.lastLogin || new Date(u.lastLogin) < cutoff).map(u => ({
    anomalyId: `anom-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, userId: u.userId, userName: u.userName, type: 'inactive' as const, description: `${inactiveDays}일 이상 미접속`, severity: 'medium' as const, recommendation: `계정 비활성화 또는 삭제 검토`
  }));
}

export function detectOverPrivileged(users: UserAccess[]): AccessAnomaly[] {
  return users.filter(u => u.roles.some(r => ADMIN_ROLES.includes(r)) && u.roles.length > 3).map(u => ({
    anomalyId: `anom-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, userId: u.userId, userName: u.userName, type: 'over_privileged' as const, description: `과다 권한 (${u.roles.length}개 역할, 관리자 포함)`, severity: 'high' as const, recommendation: `최소 권한 원칙 적용`
  }));
}

export function detectRoleConflicts(users: UserAccess[]): AccessAnomaly[] {
  const anomalies: AccessAnomaly[] = [];
  for (const u of users) {
    for (const [role, conflict] of Object.entries(CONFLICTING_ROLES)) {
      if (u.roles.includes(role) && u.roles.includes(conflict)) {
        anomalies.push({ anomalyId: `anom-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, userId: u.userId, userName: u.userName, type: 'role_conflict', description: `상충 역할: ${role} + ${conflict}`, severity: 'high', recommendation: `역할 분리 필요` });
      }
    }
  }
  return anomalies;
}

export function runAccessReview(tenantId: string, campaignName: string, users: UserAccess[]): ReviewCampaign {
  const anomalies: AccessAnomaly[] = [...detectInactive(users), ...detectOverPrivileged(users), ...detectRoleConflicts(users)];
  const campaign: ReviewCampaign = { campaignId: `rev-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, tenantId, name: campaignName, status: 'completed', totalUsers: users.length, anomalies, startedAt: new Date().toISOString(), completedAt: new Date().toISOString() };
  recordAudit({ actor: 'system', tenantId, action: 'ACCESS_REVIEW_COMPLETED', target: campaign.campaignId, details: { users: users.length, anomalies: anomalies.length } });
  return campaign;
}

export class AccessReviewAutomationService {
  constructor(private readonly tenantId: string) {}
  review(name: string, users: UserAccess[]): ReviewCampaign { return runAccessReview(this.tenantId, name, users); }
  getAuditLog(): readonly AccessReviewAuditEntry[] { return getAccessReviewAuditLog(this.tenantId); }
}
