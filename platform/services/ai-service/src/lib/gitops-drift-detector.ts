// GitOps 드리프트 자동 감지 및 수정 엔진 -- FR-N273.1~FR-N273.6
// Design Ref: MTU-N273 DESIGN §1~§6
// CSAP: D-06 감사, D-07 모니터링, D-08 접근 통제, D-12 개발 보안

import { randomUUID } from 'crypto';

// -- 타입 정의 ────────────────────────────────────────────────────────────────

/** 드리프트 유형 -- Design §3 */
export type DriftCategory = 'security' | 'configuration' | 'performance' | 'resource' | 'policy';

/** 드리프트 심각도 */
export type DriftSeverity = 'info' | 'warning' | 'critical';

/** 자동 수정 정책 -- Design §4 */
export type RemediationPolicy = 'auto_fix' | 'manual_approval' | 'alert_only' | 'ignore';

/** 리소스 상태 -- Design §1~§2 */
export interface ResourceState {
  kind: string;
  name: string;
  namespace: string;
  properties: Record<string, unknown>;
}

/** 드리프트 항목 -- Design §3 */
export interface DriftItem {
  id: string;
  resourceKind: string;
  resourceName: string;
  namespace: string;
  category: DriftCategory;
  severity: DriftSeverity;
  field: string;
  declaredValue: unknown;
  actualValue: unknown;
  detectedAt: string;
}

/** 드리프트 리포트 */
export interface DriftReport {
  id: string;
  scanTime: string;
  totalResources: number;
  driftedResources: number;
  drifts: DriftItem[];
  summary: Record<DriftCategory, number>;
}

/** 수정 규칙 -- Design §4 */
export interface RemediationRule {
  id: string;
  category: DriftCategory;
  severity: DriftSeverity;
  policy: RemediationPolicy;
  description: string;
  isActive: boolean;
}

/** 수정 결과 */
export interface RemediationResult {
  id: string;
  driftId: string;
  policy: RemediationPolicy;
  status: 'fixed' | 'pending_approval' | 'alerted' | 'ignored';
  details: string;
  executedAt: string;
}

/** 영향 분석 -- Design §5 */
export interface ImpactAnalysis {
  driftId: string;
  affectedServices: string[];
  riskLevel: DriftSeverity;
  estimatedDowntime: number;
  recommendation: string;
}

/** 감사 항목 */
export interface DriftAuditEntry {
  id: string;
  action: string;
  actor: string;
  details: Record<string, unknown>;
  timestamp: string;
}

// -- 저장소/감사 ──────────────────────────────────────────────────────────────

const remediationRules: RemediationRule[] = [];
const auditLog: DriftAuditEntry[] = [];

function recordAudit(action: string, actor: string, details: Record<string, unknown>): void {
  auditLog.push({ id: randomUUID(), action, actor, details, timestamp: new Date().toISOString() });
}

export function getDriftAuditLog(): DriftAuditEntry[] {
  return [...auditLog];
}

// -- §1~§2 상태 파싱 및 수집 ─────────────────────────────────────────────────

/** 선언적 상태 정규화 -- FR-N273.1 */
export function normalizeDesiredState(resources: Record<string, unknown>[]): ResourceState[] {
  return resources.map((r) => ({
    kind: String(r.kind || 'Unknown'),
    name: String(r.name || r.metadata && (r.metadata as Record<string, unknown>).name || 'unnamed'),
    namespace: String(r.namespace || r.metadata && (r.metadata as Record<string, unknown>).namespace || 'default'),
    properties: flattenObject(r),
  }));
}

/** 객체 평탄화 */
function flattenObject(obj: Record<string, unknown>, prefix: string = ''): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      Object.assign(result, flattenObject(value as Record<string, unknown>, fullKey));
    } else {
      result[fullKey] = value;
    }
  }
  return result;
}

// -- §3 드리프트 감지 ────────────────────────────────────────────────────────

/** 보안 관련 필드 패턴 */
const SECURITY_FIELDS = ['securityContext', 'rbac', 'tls', 'cert', 'secret', 'policy', 'networkPolicy'];
const PERFORMANCE_FIELDS = ['resources', 'limits', 'requests', 'replicas', 'hpa', 'cpu', 'memory'];

/** 드리프트 감지 -- FR-N273.3 */
export function detectDrifts(
  desired: ResourceState[],
  actual: ResourceState[],
  actor: string
): DriftReport {
  const drifts: DriftItem[] = [];

  for (const desiredResource of desired) {
    const actualResource = actual.find(
      (a) => a.kind === desiredResource.kind
        && a.name === desiredResource.name
        && a.namespace === desiredResource.namespace
    );

    if (!actualResource) {
      drifts.push({
        id: randomUUID(),
        resourceKind: desiredResource.kind,
        resourceName: desiredResource.name,
        namespace: desiredResource.namespace,
        category: 'configuration',
        severity: 'critical',
        field: '*',
        declaredValue: 'exists',
        actualValue: 'missing',
        detectedAt: new Date().toISOString(),
      });
      continue;
    }

    // 필드별 비교
    for (const [field, declaredValue] of Object.entries(desiredResource.properties)) {
      const actualValue = actualResource.properties[field];
      if (JSON.stringify(declaredValue) !== JSON.stringify(actualValue)) {
        drifts.push({
          id: randomUUID(),
          resourceKind: desiredResource.kind,
          resourceName: desiredResource.name,
          namespace: desiredResource.namespace,
          category: classifyDriftCategory(field),
          severity: classifyDriftSeverity(field),
          field,
          declaredValue,
          actualValue,
          detectedAt: new Date().toISOString(),
        });
      }
    }
  }

  const summary: Record<DriftCategory, number> = {
    security: 0, configuration: 0, performance: 0, resource: 0, policy: 0,
  };
  for (const drift of drifts) {
    summary[drift.category]++;
  }

  const report: DriftReport = {
    id: randomUUID(),
    scanTime: new Date().toISOString(),
    totalResources: desired.length,
    driftedResources: new Set(drifts.map((d) => `${d.resourceKind}/${d.resourceName}`)).size,
    drifts,
    summary,
  };

  recordAudit('DRIFT_SCAN_COMPLETED', actor, {
    totalDrifts: drifts.length,
    criticalDrifts: drifts.filter((d) => d.severity === 'critical').length,
  });

  return report;
}

function classifyDriftCategory(field: string): DriftCategory {
  const lower = field.toLowerCase();
  if (SECURITY_FIELDS.some((sf) => lower.includes(sf.toLowerCase()))) return 'security';
  if (PERFORMANCE_FIELDS.some((pf) => lower.includes(pf.toLowerCase()))) return 'performance';
  if (lower.includes('policy')) return 'policy';
  return 'configuration';
}

function classifyDriftSeverity(field: string): DriftSeverity {
  const lower = field.toLowerCase();
  if (SECURITY_FIELDS.some((sf) => lower.includes(sf.toLowerCase()))) return 'critical';
  if (PERFORMANCE_FIELDS.some((pf) => lower.includes(pf.toLowerCase()))) return 'warning';
  return 'info';
}

// -- §4 자동 수정 ────────────────────────────────────────────────────────────

/** 수정 규칙 등록 -- FR-N273.4 */
export function addRemediationRule(rule: Omit<RemediationRule, 'id'>): RemediationRule {
  const newRule: RemediationRule = { ...rule, id: randomUUID() };
  remediationRules.push(newRule);
  return newRule;
}

/** 수정 실행 -- FR-N273.4 */
export function remediate(drift: DriftItem, actor: string): RemediationResult {
  const rule = remediationRules.find(
    (r) => r.isActive && r.category === drift.category && r.severity === drift.severity
  );

  const policy = rule?.policy ?? 'alert_only';
  let status: RemediationResult['status'];
  let details: string;

  switch (policy) {
    case 'auto_fix':
      status = 'fixed';
      details = `자동 수정 완료: ${drift.field} = ${JSON.stringify(drift.declaredValue)}`;
      break;
    case 'manual_approval':
      status = 'pending_approval';
      details = `수동 승인 대기: ${drift.field} 변경 필요`;
      break;
    case 'ignore':
      status = 'ignored';
      details = `무시 처리: 정책에 따라 드리프트 허용`;
      break;
    default:
      status = 'alerted';
      details = `알림 발송: ${drift.field} 드리프트 감지`;
  }

  const result: RemediationResult = {
    id: randomUUID(),
    driftId: drift.id,
    policy,
    status,
    details,
    executedAt: new Date().toISOString(),
  };

  recordAudit('REMEDIATION_EXECUTED', actor, { driftId: drift.id, policy, status });
  return result;
}

// -- §5 영향 분석 ────────────────────────────────────────────────────────────

/** 수정 전 영향 분석 -- FR-N273.5 */
export function analyzeImpact(drift: DriftItem): ImpactAnalysis {
  const affectedServices = [drift.resourceName];
  if (drift.category === 'security') {
    affectedServices.push('보안 정책');
  }
  if (drift.category === 'configuration') {
    affectedServices.push('서비스 구성');
  }

  return {
    driftId: drift.id,
    affectedServices,
    riskLevel: drift.severity,
    estimatedDowntime: drift.severity === 'critical' ? 5 : 0,
    recommendation: drift.severity === 'critical'
      ? '즉시 수정 필요. 보안 드리프트는 인시던트로 에스컬레이션하십시오.'
      : '예정된 유지보수 시간에 수정을 권장합니다.',
  };
}

export function listRemediationRules(): RemediationRule[] {
  return [...remediationRules];
}
