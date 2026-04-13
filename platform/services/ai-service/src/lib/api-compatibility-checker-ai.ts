// Design Ref: §핵심 알고리즘 — 스키마 비교, 호환성 분류
// Plan SC: SVC-AI-ADV-R322
export type DataGrade = 'O' | 'C' | 'S'
export type ChangeType = 'added' | 'removed' | 'type_changed'

export interface SchemaField {
  name: string
  type: string
  required: boolean
}

export interface ApiSchema {
  id: string
  apiName: string
  version: string
  fields: SchemaField[]
}

export interface CompatibilityIssue {
  field: string
  changeType: ChangeType
  breaking: boolean
  detail: string
}

export interface CompatibilityReport {
  fromSchemaId: string
  toSchemaId: string
  compatible: boolean
  breakingChanges: CompatibilityIssue[]
  minorChanges: CompatibilityIssue[]
}

interface AuditEntry {
  action: string
  timestamp: string
  detail: string
}

export class ApiCompatibilityCheckerAI {
  private schemas = new Map<string, ApiSchema>()
  private reports = new Map<string, CompatibilityReport>()
  private auditLog: AuditEntry[] = []

  registerSchema(id: string, apiName: string, version: string, fields: SchemaField[]): void {
    if (!id || !apiName || !version) throw new Error('id, apiName, version은 필수')
    this.schemas.set(id, { id, apiName, version, fields: [...fields] })
    this.auditLog.push({ action: 'schema.register', timestamp: new Date().toISOString(), detail: `${apiName}@${version}` })
  }

  checkCompatibility(fromSchemaId: string, toSchemaId: string, grade: DataGrade = 'O'): CompatibilityReport {
    if (grade === 'C' || grade === 'S') {
      throw new Error(`BLOCKED: ${grade}등급 스키마 호환성 검사 금지 (N2SF N-05)`)
    }
    const from = this.schemas.get(fromSchemaId)
    const to = this.schemas.get(toSchemaId)
    if (!from) throw new Error(`fromSchemaId 없음: ${fromSchemaId}`)
    if (!to) throw new Error(`toSchemaId 없음: ${toSchemaId}`)

    const fromFields = new Map(from.fields.map((f) => [f.name, f]))
    const toFields = new Map(to.fields.map((f) => [f.name, f]))

    const breakingChanges: CompatibilityIssue[] = []
    const minorChanges: CompatibilityIssue[] = []

    // 삭제된 필드 탐지 (breaking)
    for (const [name, field] of fromFields) {
      if (!toFields.has(name)) {
        breakingChanges.push({ field: name, changeType: 'removed', breaking: true, detail: `필드 삭제: ${name} (${field.type})` })
      }
    }

    // 타입 변경 탐지 (breaking)
    for (const [name, fromField] of fromFields) {
      const toField = toFields.get(name)
      if (toField && fromField.type !== toField.type) {
        breakingChanges.push({ field: name, changeType: 'type_changed', breaking: true, detail: `타입 변경: ${fromField.type} → ${toField.type}` })
      }
    }

    // 추가된 필드 탐지 (minor)
    for (const [name, field] of toFields) {
      if (!fromFields.has(name)) {
        minorChanges.push({ field: name, changeType: 'added', breaking: false, detail: `필드 추가: ${name} (${field.type})` })
      }
    }

    const reportId = `${fromSchemaId}:${toSchemaId}`
    const report: CompatibilityReport = {
      fromSchemaId,
      toSchemaId,
      compatible: breakingChanges.length === 0,
      breakingChanges,
      minorChanges,
    }
    this.reports.set(reportId, report)
    this.auditLog.push({ action: 'compatibility.check', timestamp: new Date().toISOString(), detail: reportId })
    return report
  }

  getIssues(reportId: string): CompatibilityIssue[] {
    const report = this.reports.get(reportId)
    if (!report) return []
    return [...report.breakingChanges, ...report.minorChanges]
  }

  getAuditLog(): AuditEntry[] {
    return [...this.auditLog]
  }
}
