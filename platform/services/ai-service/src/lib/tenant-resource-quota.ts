// 테넌트 리소스 쿼터 관리 -- FR-N301.1~FR-N301.6
// Design Ref: MTU-N301 DESIGN §1~§6
// Plan SC: SC-1 (초과탐지 100%), SC-2 (추적지연 5초), SC-3 (알림전달 30초), SC-4 (감사 100%)
// CSAP: D-06 감사 로그, D-08 접근통제

// -- 타입 정의 ────────────────────────────────────────────────────────────────

/** 리소스 타입 */
export type ResourceType = 'cpu' | 'memory' | 'storage' | 'api_calls' | 'users' | 'bandwidth';

/** 쿼터 정책 */
export interface QuotaPolicy {
  readonly policyId: string;
  readonly tenantId: string;
  readonly resourceType: ResourceType;
  readonly limit: number;
  readonly unit: string;
  readonly warningThreshold: number; // 0~1 비율
  readonly hardLimit: boolean;
  readonly period: 'hourly' | 'daily' | 'monthly';
  readonly createdAt: string;
  readonly updatedAt: string;
}

/** 사용량 레코드 */
export interface UsageRecord {
  readonly recordId: string;
  readonly tenantId: string;
  readonly resourceType: ResourceType;
  readonly currentUsage: number;
  readonly limit: number;
  readonly usageRate: number;
  readonly timestamp: string;
}

/** 쿼터 초과 알림 */
export interface QuotaAlert {
  readonly alertId: string;
  readonly tenantId: string;
  readonly resourceType: ResourceType;
  readonly alertType: 'warning' | 'exceeded' | 'blocked';
  readonly currentUsage: number;
  readonly limit: number;
  readonly usageRate: number;
  readonly message: string;
  readonly createdAt: string;
}

/** 쿼터 템플릿 */
export interface QuotaTemplate {
  readonly templateId: string;
  readonly name: string;
  readonly tier: 'small' | 'medium' | 'large';
  readonly quotas: Array<{ resourceType: ResourceType; limit: number; unit: string }>;
}

/** 사용량 트렌드 */
export interface UsageTrend {
  readonly tenantId: string;
  readonly resourceType: ResourceType;
  readonly dataPoints: Array<{ date: string; usage: number }>;
  readonly trend: 'increasing' | 'decreasing' | 'stable';
  readonly projectedExceedDate: string | null;
}

/** 감사 로그 */
export interface QuotaAuditEntry {
  readonly timestamp: string;
  readonly actor: string;
  readonly tenantId: string;
  readonly action: string;
  readonly target: string;
  readonly details: Record<string, unknown>;
}

// -- 감사 로그 ────────────────────────────────────────────────────────────────

const auditLog: QuotaAuditEntry[] = [];

function recordAudit(entry: Omit<QuotaAuditEntry, 'timestamp'>): void {
  auditLog.push({ ...entry, timestamp: new Date().toISOString() });
}

export function getQuotaAuditLog(tenantId: string): readonly QuotaAuditEntry[] {
  return auditLog.filter(e => e.tenantId === tenantId);
}

// -- 쿼터 정책 CRUD ──────────────────────────────────────────────────────────

const policyStore: Map<string, QuotaPolicy[]> = new Map();

/** 쿼터 정책 생성 -- FR-N301.1 */
export function createQuotaPolicy(
  tenantId: string,
  resourceType: ResourceType,
  limit: number,
  unit: string,
  options?: { warningThreshold?: number; hardLimit?: boolean; period?: QuotaPolicy['period'] },
): QuotaPolicy {
  const now = new Date().toISOString();
  const policy: QuotaPolicy = {
    policyId: `quota-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    tenantId,
    resourceType,
    limit,
    unit,
    warningThreshold: options?.warningThreshold ?? 0.8,
    hardLimit: options?.hardLimit ?? true,
    period: options?.period ?? 'monthly',
    createdAt: now,
    updatedAt: now,
  };

  const existing = policyStore.get(tenantId) ?? [];
  existing.push(policy);
  policyStore.set(tenantId, existing);

  recordAudit({
    actor: 'system',
    tenantId,
    action: 'QUOTA_POLICY_CREATED',
    target: policy.policyId,
    details: { resourceType, limit, unit },
  });

  return policy;
}

/** 쿼터 정책 조회 */
export function getQuotaPolicies(tenantId: string): readonly QuotaPolicy[] {
  return policyStore.get(tenantId) ?? [];
}

/** 쿼터 정책 삭제 */
export function deleteQuotaPolicy(tenantId: string, policyId: string): boolean {
  const existing = policyStore.get(tenantId) ?? [];
  const filtered = existing.filter(p => p.policyId !== policyId);

  if (filtered.length === existing.length) return false;

  policyStore.set(tenantId, filtered);

  recordAudit({
    actor: 'system',
    tenantId,
    action: 'QUOTA_POLICY_DELETED',
    target: policyId,
    details: {},
  });

  return true;
}

// -- 사용량 추적 ──────────────────────────────────────────────────────────────

const usageStore: Map<string, UsageRecord[]> = new Map();

/** 사용량 기록 -- FR-N301.2 */
export function recordUsage(
  tenantId: string,
  resourceType: ResourceType,
  usage: number,
): UsageRecord {
  const policies = getQuotaPolicies(tenantId);
  const policy = policies.find(p => p.resourceType === resourceType);
  const limit = policy?.limit ?? Infinity;
  const usageRate = limit > 0 && limit !== Infinity ? usage / limit : 0;

  const record: UsageRecord = {
    recordId: `usage-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    tenantId,
    resourceType,
    currentUsage: usage,
    limit,
    usageRate,
    timestamp: new Date().toISOString(),
  };

  const key = `${tenantId}:${resourceType}`;
  const existing = usageStore.get(key) ?? [];
  existing.push(record);
  usageStore.set(key, existing);

  return record;
}

/** 현재 사용량 조회 */
export function getCurrentUsage(tenantId: string, resourceType: ResourceType): UsageRecord | null {
  const key = `${tenantId}:${resourceType}`;
  const records = usageStore.get(key) ?? [];
  const lastRecord = records[records.length - 1];
  return lastRecord ?? null;
}

// -- 초과 감지 ────────────────────────────────────────────────────────────────

const alertStore: QuotaAlert[] = [];

/** 쿼터 초과 감지 및 알림 -- FR-N301.3 */
export function checkQuotaExceedance(
  tenantId: string,
  resourceType: ResourceType,
  currentUsage: number,
): QuotaAlert | null {
  const policies = getQuotaPolicies(tenantId);
  const policy = policies.find(p => p.resourceType === resourceType);

  if (!policy) return null;

  const usageRate = currentUsage / policy.limit;

  if (usageRate >= 1.0) {
    const alert: QuotaAlert = {
      alertId: `alert-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      tenantId,
      resourceType,
      alertType: policy.hardLimit ? 'blocked' : 'exceeded',
      currentUsage,
      limit: policy.limit,
      usageRate,
      message: `${resourceType} 쿼터 초과: ${currentUsage}/${policy.limit} ${policy.unit} (${(usageRate * 100).toFixed(1)}%)`,
      createdAt: new Date().toISOString(),
    };

    alertStore.push(alert);

    recordAudit({
      actor: 'system',
      tenantId,
      action: 'QUOTA_EXCEEDED',
      target: policy.policyId,
      details: { resourceType, currentUsage, limit: policy.limit, usageRate },
    });

    return alert;
  }

  if (usageRate >= policy.warningThreshold) {
    const alert: QuotaAlert = {
      alertId: `alert-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      tenantId,
      resourceType,
      alertType: 'warning',
      currentUsage,
      limit: policy.limit,
      usageRate,
      message: `${resourceType} 쿼터 경고: ${currentUsage}/${policy.limit} ${policy.unit} (${(usageRate * 100).toFixed(1)}%)`,
      createdAt: new Date().toISOString(),
    };

    alertStore.push(alert);

    recordAudit({
      actor: 'system',
      tenantId,
      action: 'QUOTA_WARNING',
      target: policy.policyId,
      details: { resourceType, currentUsage, limit: policy.limit, usageRate },
    });

    return alert;
  }

  return null;
}

/** 알림 이력 조회 */
export function getQuotaAlerts(tenantId: string): readonly QuotaAlert[] {
  return alertStore.filter(a => a.tenantId === tenantId);
}

// -- 쿼터 템플릿 ──────────────────────────────────────────────────────────────

/** 쿼터 정책 템플릿 -- FR-N301.5 */
export const QUOTA_TEMPLATES: readonly QuotaTemplate[] = [
  {
    templateId: 'tmpl-small',
    name: '소규모 기관',
    tier: 'small',
    quotas: [
      { resourceType: 'cpu', limit: 4, unit: 'cores' },
      { resourceType: 'memory', limit: 8192, unit: 'MB' },
      { resourceType: 'storage', limit: 100, unit: 'GB' },
      { resourceType: 'api_calls', limit: 100000, unit: 'calls/month' },
      { resourceType: 'users', limit: 50, unit: 'users' },
      { resourceType: 'bandwidth', limit: 100, unit: 'GB/month' },
    ],
  },
  {
    templateId: 'tmpl-medium',
    name: '중규모 기관',
    tier: 'medium',
    quotas: [
      { resourceType: 'cpu', limit: 16, unit: 'cores' },
      { resourceType: 'memory', limit: 32768, unit: 'MB' },
      { resourceType: 'storage', limit: 500, unit: 'GB' },
      { resourceType: 'api_calls', limit: 1000000, unit: 'calls/month' },
      { resourceType: 'users', limit: 500, unit: 'users' },
      { resourceType: 'bandwidth', limit: 500, unit: 'GB/month' },
    ],
  },
  {
    templateId: 'tmpl-large',
    name: '대규모 기관',
    tier: 'large',
    quotas: [
      { resourceType: 'cpu', limit: 64, unit: 'cores' },
      { resourceType: 'memory', limit: 131072, unit: 'MB' },
      { resourceType: 'storage', limit: 2000, unit: 'GB' },
      { resourceType: 'api_calls', limit: 10000000, unit: 'calls/month' },
      { resourceType: 'users', limit: 5000, unit: 'users' },
      { resourceType: 'bandwidth', limit: 2000, unit: 'GB/month' },
    ],
  },
] as const;

/** 템플릿으로 쿼터 일괄 생성 */
export function applyQuotaTemplate(tenantId: string, tier: QuotaTemplate['tier']): QuotaPolicy[] {
  const template = QUOTA_TEMPLATES.find(t => t.tier === tier);
  if (!template) return [];

  const policies: QuotaPolicy[] = [];
  for (const quota of template.quotas) {
    policies.push(createQuotaPolicy(tenantId, quota.resourceType, quota.limit, quota.unit));
  }

  recordAudit({
    actor: 'system',
    tenantId,
    action: 'QUOTA_TEMPLATE_APPLIED',
    target: template.templateId,
    details: { tier, policiesCreated: policies.length },
  });

  return policies;
}

// -- 사용량 트렌드 ────────────────────────────────────────────────────────────

/** 사용량 히스토리 및 트렌드 -- FR-N301.4 */
export function getUsageTrend(
  tenantId: string,
  resourceType: ResourceType,
): UsageTrend {
  const key = `${tenantId}:${resourceType}`;
  const records = usageStore.get(key) ?? [];

  const dataPoints = records.map(r => ({
    date: r.timestamp,
    usage: r.currentUsage,
  }));

  let trend: UsageTrend['trend'] = 'stable';
  if (dataPoints.length >= 2) {
    const firstPoint = dataPoints[0];
    const lastPoint = dataPoints[dataPoints.length - 1];
    if (firstPoint && lastPoint) {
      const delta = lastPoint.usage - firstPoint.usage;
      if (delta > firstPoint.usage * 0.1) trend = 'increasing';
      else if (delta < -firstPoint.usage * 0.1) trend = 'decreasing';
    }
  }

  let projectedExceedDate: string | null = null;
  if (trend === 'increasing' && dataPoints.length >= 2) {
    const policies = getQuotaPolicies(tenantId);
    const policy = policies.find(p => p.resourceType === resourceType);
    const lastPoint = dataPoints[dataPoints.length - 1];
    if (policy && lastPoint && lastPoint.usage < policy.limit) {
      const remaining = policy.limit - lastPoint.usage;
      const growthPerDay = lastPoint.usage * 0.02; // 일 2% 성장 가정
      if (growthPerDay > 0) {
        const daysToExceed = Math.ceil(remaining / growthPerDay);
        const exceedDate = new Date();
        exceedDate.setDate(exceedDate.getDate() + daysToExceed);
        projectedExceedDate = exceedDate.toISOString().split('T')[0] ?? null;
      }
    }
  }

  return { tenantId, resourceType, dataPoints, trend, projectedExceedDate };
}

/** 테넌트 리소스 쿼터 서비스 */
export class TenantResourceQuotaService {
  constructor(private readonly tenantId: string) {}

  createPolicy(resourceType: ResourceType, limit: number, unit: string): QuotaPolicy {
    return createQuotaPolicy(this.tenantId, resourceType, limit, unit);
  }

  getPolicies(): readonly QuotaPolicy[] {
    return getQuotaPolicies(this.tenantId);
  }

  deletePolicy(policyId: string): boolean {
    return deleteQuotaPolicy(this.tenantId, policyId);
  }

  recordUsage(resourceType: ResourceType, usage: number): UsageRecord {
    return recordUsage(this.tenantId, resourceType, usage);
  }

  checkExceedance(resourceType: ResourceType, usage: number): QuotaAlert | null {
    return checkQuotaExceedance(this.tenantId, resourceType, usage);
  }

  applyTemplate(tier: QuotaTemplate['tier']): QuotaPolicy[] {
    return applyQuotaTemplate(this.tenantId, tier);
  }

  getTrend(resourceType: ResourceType): UsageTrend {
    return getUsageTrend(this.tenantId, resourceType);
  }

  getAlerts(): readonly QuotaAlert[] {
    return getQuotaAlerts(this.tenantId);
  }

  getAuditLog(): readonly QuotaAuditEntry[] {
    return getQuotaAuditLog(this.tenantId);
  }
}
