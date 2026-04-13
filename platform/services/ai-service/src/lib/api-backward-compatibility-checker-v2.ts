// Design Ref: §R432 — AI기반 자동 API 하위 호환성 검증 v2
// Plan SC: SVC-AI-ADV-R432-SC01

export type BreakingChangeType =
  | 'FIELD_REMOVED'
  | 'TYPE_CHANGED'
  | 'ENDPOINT_REMOVED'
  | 'REQUIRED_FIELD_ADDED'
  | 'STATUS_CODE_CHANGED'
  | 'ENUM_VALUE_REMOVED'

export type CompatibilityStatus = 'COMPATIBLE' | 'WARNING' | 'BREAKING'

export interface ApiSchema {
  apiId: string
  version: string
  endpoints: Array<{
    path: string
    method: string
    requestFields: Array<{ name: string; type: string; required: boolean }>
    responseFields: Array<{ name: string; type: string }>
    statusCodes: number[]
  }>
}

export interface CompatibilityIssue {
  type: BreakingChangeType
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
  path: string
  detail: string
}

export interface CompatibilityReport {
  apiId: string
  oldVersion: string
  newVersion: string
  status: CompatibilityStatus
  issues: CompatibilityIssue[]
  breakingCount: number
  warningCount: number
}

interface AuditEntry {
  timestamp: string
  action: string
  apiId: string
  detail: Record<string, unknown>
}

export class ApiBackwardCompatibilityCheckerV2 {
  private schemas = new Map<string, ApiSchema[]>()  // apiId → versions
  private auditLog: AuditEntry[] = []

  registerSchema(schema: ApiSchema): void {
    const list = this.schemas.get(schema.apiId) ?? []
    list.push(schema)
    this.schemas.set(schema.apiId, list)
    this.appendAudit('schema.register', schema.apiId, { version: schema.version, endpointCount: schema.endpoints.length })
  }

  check(apiId: string, oldVersion: string, newVersion: string): CompatibilityReport {
    const versions = this.schemas.get(apiId) ?? []
    const oldSchema = versions.find((s) => s.version === oldVersion)
    const newSchema = versions.find((s) => s.version === newVersion)

    if (!oldSchema) throw new Error(`Unknown schema version: ${apiId}@${oldVersion}`)
    if (!newSchema) throw new Error(`Unknown schema version: ${apiId}@${newVersion}`)

    this.appendAudit('compat.check', apiId, { oldVersion, newVersion })

    const issues: CompatibilityIssue[] = []

    for (const oldEp of oldSchema.endpoints) {
      const newEp = newSchema.endpoints.find((e) => e.path === oldEp.path && e.method === oldEp.method)

      // 엔드포인트 제거
      if (!newEp) {
        issues.push({ type: 'ENDPOINT_REMOVED', severity: 'CRITICAL', path: `${oldEp.method} ${oldEp.path}`, detail: '엔드포인트 제거됨 — 클라이언트 호환 불가' })
        continue
      }

      // 응답 필드 제거 확인
      for (const oldField of oldEp.responseFields) {
        const newField = newEp.responseFields.find((f) => f.name === oldField.name)
        if (!newField) {
          issues.push({ type: 'FIELD_REMOVED', severity: 'HIGH', path: `${oldEp.method} ${oldEp.path} > response.${oldField.name}`, detail: `응답 필드 '${oldField.name}' 제거됨` })
        } else if (newField.type !== oldField.type) {
          issues.push({ type: 'TYPE_CHANGED', severity: 'HIGH', path: `${oldEp.method} ${oldEp.path} > response.${oldField.name}`, detail: `타입 변경: ${oldField.type} → ${newField.type}` })
        }
      }

      // 필수 요청 필드 추가 확인
      for (const newField of newEp.requestFields) {
        if (newField.required) {
          const oldField = oldEp.requestFields.find((f) => f.name === newField.name)
          if (!oldField) {
            issues.push({ type: 'REQUIRED_FIELD_ADDED', severity: 'HIGH', path: `${oldEp.method} ${oldEp.path} > request.${newField.name}`, detail: `필수 요청 필드 '${newField.name}' 추가됨` })
          }
        }
      }

      // 상태 코드 제거 확인
      for (const oldCode of oldEp.statusCodes) {
        if (!newEp.statusCodes.includes(oldCode)) {
          issues.push({ type: 'STATUS_CODE_CHANGED', severity: 'MEDIUM', path: `${oldEp.method} ${oldEp.path}`, detail: `상태 코드 ${oldCode} 제거됨` })
        }
      }
    }

    const breakingCount = issues.filter((i) => i.severity === 'CRITICAL' || i.severity === 'HIGH').length
    const warningCount = issues.filter((i) => i.severity === 'MEDIUM' || i.severity === 'LOW').length

    const status: CompatibilityStatus =
      breakingCount > 0 ? 'BREAKING'
        : warningCount > 0 ? 'WARNING'
        : 'COMPATIBLE'

    return { apiId, oldVersion, newVersion, status, issues, breakingCount, warningCount }
  }

  getAuditLog(): AuditEntry[] {
    return [...this.auditLog]
  }

  private appendAudit(action: string, apiId: string, detail: Record<string, unknown>): void {
    this.auditLog.push({ timestamp: new Date().toISOString(), action, apiId, detail })
  }
}
