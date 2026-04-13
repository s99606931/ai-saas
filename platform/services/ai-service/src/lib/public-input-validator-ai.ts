// Design Ref: §R316 — AI기반 공공 입력 데이터 자동 검증
// Plan SC: SC-R316

export interface ValidationRule {
  ruleId: string
  fieldName: string
  type: 'REQUIRED' | 'FORMAT' | 'RANGE' | 'CUSTOM'
  pattern?: string
  minValue?: number
  maxValue?: number
  minLength?: number
  maxLength?: number
  errorMessage: string
}

export interface ValidationSchema {
  schemaId: string
  name: string
  rules: ValidationRule[]
}

export interface ValidationViolation {
  ruleId: string
  fieldName: string
  violationType: ValidationRule['type']
  message: string
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM'
}

export interface ValidationResult {
  schemaId: string
  isValid: boolean
  violations: ValidationViolation[]
  sanitizedFields: string[]
}

interface AuditEntry {
  action: string
  timestamp: string
  detail: string
}

export class PublicInputValidatorAi {
  private schemas = new Map<string, ValidationSchema>()
  private auditLog: AuditEntry[] = []

  registerSchema(schema: ValidationSchema): void {
    this.schemas.set(schema.schemaId, schema)
    this.auditLog.push({ action: 'schema.register', timestamp: new Date().toISOString(), detail: schema.schemaId })
  }

  validate(schemaId: string, input: Record<string, unknown>): ValidationResult {
    const schema = this.schemas.get(schemaId)
    if (!schema) throw new Error(`Schema not found: ${schemaId}`)

    const violations: ValidationViolation[] = []
    const sanitizedFields: string[] = []

    for (const rule of schema.rules) {
      const value = input[rule.fieldName]

      if (rule.type === 'REQUIRED') {
        if (value === undefined || value === null || value === '') {
          violations.push({ ruleId: rule.ruleId, fieldName: rule.fieldName, violationType: 'REQUIRED', message: rule.errorMessage, severity: 'CRITICAL' })
        }
        continue
      }

      if (value === undefined || value === null) continue

      const strValue = String(value)

      if (rule.type === 'FORMAT' && rule.pattern) {
        const regex = new RegExp(rule.pattern)
        if (!regex.test(strValue)) {
          violations.push({ ruleId: rule.ruleId, fieldName: rule.fieldName, violationType: 'FORMAT', message: rule.errorMessage, severity: 'HIGH' })
        } else {
          sanitizedFields.push(rule.fieldName)
        }
      } else if (rule.type === 'RANGE') {
        const numValue = Number(value)
        if (isNaN(numValue)) {
          violations.push({ ruleId: rule.ruleId, fieldName: rule.fieldName, violationType: 'RANGE', message: '숫자 형식이 아닙니다', severity: 'HIGH' })
        } else if ((rule.minValue !== undefined && numValue < rule.minValue) || (rule.maxValue !== undefined && numValue > rule.maxValue)) {
          violations.push({ ruleId: rule.ruleId, fieldName: rule.fieldName, violationType: 'RANGE', message: rule.errorMessage, severity: 'MEDIUM' })
        }
      } else if (rule.type === 'CUSTOM') {
        if (rule.minLength !== undefined && strValue.length < rule.minLength) {
          violations.push({ ruleId: rule.ruleId, fieldName: rule.fieldName, violationType: 'CUSTOM', message: rule.errorMessage, severity: 'MEDIUM' })
        } else if (rule.maxLength !== undefined && strValue.length > rule.maxLength) {
          violations.push({ ruleId: rule.ruleId, fieldName: rule.fieldName, violationType: 'CUSTOM', message: rule.errorMessage, severity: 'MEDIUM' })
        }
      }
    }

    const isValid = violations.filter((v) => v.severity === 'CRITICAL' || v.severity === 'HIGH').length === 0

    this.auditLog.push({ action: 'input.validate', timestamp: new Date().toISOString(), detail: `${schemaId}:${isValid ? 'VALID' : 'INVALID'}` })
    return { schemaId, isValid, violations, sanitizedFields }
  }

  getAuditLog(): AuditEntry[] {
    return [...this.auditLog]
  }
}
