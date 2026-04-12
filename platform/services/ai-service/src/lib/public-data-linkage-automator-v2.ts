// Design Ref: §핵심 알고리즘 — 필드 매핑 실행, 검증
// Plan SC: SVC-AI-ADV-R308
export type DataGrade = 'O' | 'C' | 'S'

export interface DataSource {
  id: string
  name: string
  fields: string[]
}

export interface FieldMapping {
  sourceField: string
  targetField: string
}

export interface MappingRule {
  ruleId: string
  sourceId: string
  targetId: string
  fieldMappings: FieldMapping[]
  targetSchema?: { requiredFields: string[] }
}

export interface LinkageResult {
  ruleId: string
  targetRecord: Record<string, unknown>
  mappedFields: number
}

export interface ValidationResult {
  valid: boolean
  missingFields: string[]
}

interface AuditEntry {
  action: string
  timestamp: string
  detail: string
}

export class PublicDataLinkageAutomatorV2 {
  private sources = new Map<string, DataSource>()
  private rules = new Map<string, MappingRule>()
  private auditLog: AuditEntry[] = []

  registerSource(id: string, name: string, fields: string[]): void {
    if (!id || !name) throw new Error('id와 name은 필수')
    this.sources.set(id, { id, name, fields })
    this.auditLog.push({ action: 'source.register', timestamp: new Date().toISOString(), detail: id })
  }

  registerMappingRule(
    ruleId: string,
    sourceId: string,
    targetId: string,
    fieldMappings: FieldMapping[],
    targetSchema?: { requiredFields: string[] }
  ): void {
    if (!ruleId || !sourceId || !targetId) throw new Error('ruleId, sourceId, targetId는 필수')
    this.rules.set(ruleId, { ruleId, sourceId, targetId, fieldMappings, targetSchema })
    this.auditLog.push({ action: 'rule.register', timestamp: new Date().toISOString(), detail: ruleId })
  }

  execute(ruleId: string, sourceRecord: Record<string, unknown>, grade: DataGrade = 'O'): LinkageResult {
    if (grade === 'C' || grade === 'S') {
      throw new Error(`BLOCKED: ${grade}등급 데이터는 AI API 전송 금지 (N2SF N-05)`)
    }
    const rule = this.rules.get(ruleId)
    if (!rule) throw new Error(`ruleId 없음: ${ruleId}`)
    const targetRecord: Record<string, unknown> = {}
    let mappedFields = 0
    for (const mapping of rule.fieldMappings) {
      if (Object.prototype.hasOwnProperty.call(sourceRecord, mapping.sourceField)) {
        targetRecord[mapping.targetField] = sourceRecord[mapping.sourceField]
        mappedFields++
      }
    }
    this.auditLog.push({
      action: 'linkage.execute',
      timestamp: new Date().toISOString(),
      detail: `${ruleId}:mapped=${mappedFields}`,
    })
    return { ruleId, targetRecord, mappedFields }
  }

  validate(ruleId: string, result: LinkageResult): ValidationResult {
    const rule = this.rules.get(ruleId)
    if (!rule) throw new Error(`ruleId 없음: ${ruleId}`)
    const required = rule.targetSchema?.requiredFields ?? []
    const missing = required.filter((f) => !Object.prototype.hasOwnProperty.call(result.targetRecord, f))
    return { valid: missing.length === 0, missingFields: missing }
  }

  getAuditLog(): AuditEntry[] {
    return [...this.auditLog]
  }
}
