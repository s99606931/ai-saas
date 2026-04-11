// API 버전 관리/호환성 체크 -- FR-N332.1~FR-N332.4
// Design Ref: MTU-N332 | CSAP: D-06, D-08, D-13

export interface APIVersion { readonly versionId: string; readonly tenantId: string; readonly apiName: string; readonly version: string; readonly status: 'active' | 'deprecated' | 'retired'; readonly schema: Record<string, unknown>; readonly deprecatedAt: string | null; readonly retiredAt: string | null; readonly createdAt: string; }
export interface CompatibilityResult { readonly compatible: boolean; readonly breakingChanges: readonly string[]; readonly addedFields: readonly string[]; readonly removedFields: readonly string[]; }
export interface MigrationGuide { readonly guideId: string; readonly fromVersion: string; readonly toVersion: string; readonly steps: readonly string[]; readonly generatedAt: string; }
export interface ApiVerAuditEntry { readonly timestamp: string; readonly actor: string; readonly tenantId: string; readonly action: string; readonly target: string; readonly details: Record<string, unknown>; }

const auditLog: ApiVerAuditEntry[] = [];
function recordAudit(entry: Omit<ApiVerAuditEntry, 'timestamp'>): void { auditLog.push({ ...entry, timestamp: new Date().toISOString() }); }
export function getApiVerAuditLog(tenantId: string): readonly ApiVerAuditEntry[] { return auditLog.filter(e => e.tenantId === tenantId); }

const versionStore: Map<string, APIVersion[]> = new Map();

export function registerVersion(tenantId: string, apiName: string, version: string, schema: Record<string, unknown>): APIVersion {
  const v: APIVersion = { versionId: `apiv-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, tenantId, apiName, version, status: 'active', schema, deprecatedAt: null, retiredAt: null, createdAt: new Date().toISOString() };
  const existing = versionStore.get(tenantId) ?? [];
  existing.push(v);
  versionStore.set(tenantId, existing);
  recordAudit({ actor: 'system', tenantId, action: 'API_VERSION_REGISTERED', target: v.versionId, details: { apiName, version } });
  return v;
}

export function deprecateVersion(tenantId: string, versionId: string): APIVersion | null {
  const versions = versionStore.get(tenantId) ?? [];
  const idx = versions.findIndex(v => v.versionId === versionId);
  if (idx < 0) return null;
  const updated = { ...versions[idx]!, status: 'deprecated' as const, deprecatedAt: new Date().toISOString() };
  versions[idx] = updated;
  recordAudit({ actor: 'system', tenantId, action: 'API_VERSION_DEPRECATED', target: versionId, details: {} });
  return updated;
}

export function checkCompatibility(oldSchema: Record<string, unknown>, newSchema: Record<string, unknown>): CompatibilityResult {
  const oldKeys = Object.keys(oldSchema);
  const newKeys = Object.keys(newSchema);
  const removed = oldKeys.filter(k => !newKeys.includes(k));
  const added = newKeys.filter(k => !oldKeys.includes(k));
  const breaking: string[] = [];
  for (const k of removed) breaking.push(`필드 제거됨: ${k}`);
  for (const k of oldKeys) {
    if (newKeys.includes(k) && typeof oldSchema[k] !== typeof newSchema[k]) {
      breaking.push(`타입 변경됨: ${k} (${typeof oldSchema[k]} -> ${typeof newSchema[k]})`);
    }
  }
  return { compatible: breaking.length === 0, breakingChanges: breaking, addedFields: added, removedFields: removed };
}

export function generateMigrationGuide(fromVersion: string, toVersion: string, compat: CompatibilityResult): MigrationGuide {
  const steps: string[] = [];
  if (compat.removedFields.length > 0) steps.push(`제거된 필드 대체 구현: ${compat.removedFields.join(', ')}`);
  if (compat.addedFields.length > 0) steps.push(`신규 필드 활용 검토: ${compat.addedFields.join(', ')}`);
  for (const bc of compat.breakingChanges) steps.push(`Breaking Change 대응: ${bc}`);
  if (steps.length === 0) steps.push('호환 가능 - 별도 마이그레이션 불필요');
  return { guideId: `mig-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, fromVersion, toVersion, steps, generatedAt: new Date().toISOString() };
}

export class ApiVersioningManagerService {
  constructor(private readonly tenantId: string) {}
  register(api: string, ver: string, schema: Record<string, unknown>): APIVersion { return registerVersion(this.tenantId, api, ver, schema); }
  deprecate(versionId: string): APIVersion | null { return deprecateVersion(this.tenantId, versionId); }
  checkCompat(old: Record<string, unknown>, neu: Record<string, unknown>): CompatibilityResult { return checkCompatibility(old, neu); }
  guide(from: string, to: string, compat: CompatibilityResult): MigrationGuide { return generateMigrationGuide(from, to, compat); }
  getAuditLog(): readonly ApiVerAuditEntry[] { return getApiVerAuditLog(this.tenantId); }
}
