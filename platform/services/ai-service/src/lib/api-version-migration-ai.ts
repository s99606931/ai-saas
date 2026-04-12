// Design Ref: §R189 — AI기반 API 버전 마이그레이션 지원
// Plan SC: SVC-AI-ADV-R189-SC01

export interface ApiVersion {
  versionId: string
  semver: string
  endpoints: Array<{ path: string; method: string; deprecated?: boolean }>
  releaseDate: string
}

export interface MigrationPlan {
  fromVersion: string
  toVersion: string
  steps: MigrationStep[]
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH'
  estimatedEffortHours: number
}

export interface MigrationStep {
  stepId: string
  description: string
  type: 'RENAME' | 'REMOVE' | 'ADD' | 'MODIFY'
  affectedEndpoint?: string
}

interface AuditEntry {
  timestamp: string
  action: string
  detail: Record<string, unknown>
}

export class ApiVersionMigrationAI {
  private versions = new Map<string, ApiVersion>()
  private auditLog: AuditEntry[] = []

  registerVersion(version: ApiVersion): void {
    this.versions.set(version.versionId, version)
    this.appendAudit('version.register', { versionId: version.versionId, semver: version.semver })
  }

  generateMigrationPlan(fromVersionId: string, toVersionId: string): MigrationPlan {
    const from = this.versions.get(fromVersionId)
    const to = this.versions.get(toVersionId)
    if (!from) throw new Error(`Unknown version: ${fromVersionId}`)
    if (!to) throw new Error(`Unknown version: ${toVersionId}`)

    const fromPaths = new Set(from.endpoints.map((e) => `${e.method}:${e.path}`))
    const toPaths = new Set(to.endpoints.map((e) => `${e.method}:${e.path}`))

    const steps: MigrationStep[] = []
    let stepNum = 1

    // Removed endpoints
    for (const key of fromPaths) {
      if (!toPaths.has(key)) {
        steps.push({
          stepId: `STEP-${stepNum++}`,
          description: `엔드포인트 제거: ${key}`,
          type: 'REMOVE',
          affectedEndpoint: key,
        })
      }
    }

    // Added endpoints
    for (const key of toPaths) {
      if (!fromPaths.has(key)) {
        steps.push({
          stepId: `STEP-${stepNum++}`,
          description: `신규 엔드포인트 추가: ${key}`,
          type: 'ADD',
          affectedEndpoint: key,
        })
      }
    }

    // Deprecated endpoints still in to-version
    const deprecated = to.endpoints.filter((e) => e.deprecated)
    for (const dep of deprecated) {
      steps.push({
        stepId: `STEP-${stepNum++}`,
        description: `Deprecated 엔드포인트 처리: ${dep.method}:${dep.path}`,
        type: 'MODIFY',
        affectedEndpoint: `${dep.method}:${dep.path}`,
      })
    }

    const removedCount = steps.filter((s) => s.type === 'REMOVE').length
    const riskLevel: MigrationPlan['riskLevel'] = removedCount >= 5 ? 'HIGH' : removedCount >= 2 ? 'MEDIUM' : 'LOW'
    const estimatedEffortHours = steps.length * 2

    this.appendAudit('migration.plan', { fromVersionId, toVersionId, steps: steps.length, riskLevel })

    return {
      fromVersion: from.semver,
      toVersion: to.semver,
      steps,
      riskLevel,
      estimatedEffortHours,
    }
  }

  getAuditLog(): AuditEntry[] {
    return [...this.auditLog]
  }

  private appendAudit(action: string, detail: Record<string, unknown>): void {
    this.auditLog.push({ timestamp: new Date().toISOString(), action, detail })
  }
}
