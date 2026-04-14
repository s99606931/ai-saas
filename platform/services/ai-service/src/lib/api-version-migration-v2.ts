// Design Ref: §설계결정 — AI기반 API 버전 마이그레이션 v2
// Plan SC: FR-R625.1~5

interface ApiVersion { versionId: string; apiName: string; version: string; deprecated: boolean; endpointCount: number }
interface MigrationRecord { fromVersion: string; toVersion: string; migratedEndpoints: number; totalEndpoints: number }
interface AuditEntry { timestamp: string; action: string; details?: Record<string, unknown> }

export class ApiVersionMigrationV2 {
  private versions = new Map<string, ApiVersion>()
  private migrations = new Map<string, MigrationRecord>()
  private auditLog: AuditEntry[] = []

  registerVersion(versionId: string, apiName: string, version: string, endpointCount: number): void {
    this.versions.set(versionId, { versionId, apiName, version, deprecated: false, endpointCount })
    this.auditLog.push({ timestamp: new Date().toISOString(), action: 'REGISTER_VERSION', details: { versionId, apiName, version } })
  }

  deprecateVersion(versionId: string): void {
    const v = this.versions.get(versionId)
    if (v) this.versions.set(versionId, { ...v, deprecated: true })
    this.auditLog.push({ timestamp: new Date().toISOString(), action: 'DEPRECATE_VERSION', details: { versionId } })
  }

  recordMigration(migrationId: string, fromVersion: string, toVersion: string, migratedEndpoints: number, totalEndpoints: number, dataGrade?: string): void {
    if (dataGrade === 'C' || dataGrade === 'S') {
      throw new Error(`BLOCKED: ${dataGrade}등급 데이터는 AI API 전송 금지 (N2SF N-05)`)
    }
    this.migrations.set(migrationId, { fromVersion, toVersion, migratedEndpoints, totalEndpoints })
    this.auditLog.push({ timestamp: new Date().toISOString(), action: 'RECORD_MIGRATION', details: { migrationId, fromVersion, toVersion, migratedEndpoints, totalEndpoints } })
  }

  getMigrationProgress(migrationId: string): number {
    const m = this.migrations.get(migrationId)
    if (!m || m.totalEndpoints === 0) return 0
    return (m.migratedEndpoints / m.totalEndpoints) * 100
  }

  getDeprecatedVersions(): ApiVersion[] {
    return Array.from(this.versions.values()).filter(v => v.deprecated)
  }

  getAuditLog(): AuditEntry[] { return [...this.auditLog] }
}
