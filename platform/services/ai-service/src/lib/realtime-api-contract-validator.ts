// Design Ref: §R273 — AI기반 실시간 API 계약 검증
// Plan SC: SVC-AI-ADV-R273-SC01
// CSAP D-06: 감사 로그, D-12: 입력 검증

export type FieldType = 'string' | 'number' | 'boolean' | 'array' | 'object'
export type ContractViolationType = 'MISSING_FIELD' | 'TYPE_MISMATCH' | 'SCHEMA_CHANGED' | 'DEPRECATED_FIELD' | 'BREAKING_CHANGE'

export interface FieldSchema {
  fieldName: string
  type: FieldType
  required: boolean
  deprecated?: boolean
}

export interface ApiContract {
  contractId: string
  serviceName: string
  endpoint: string
  version: string
  schema: FieldSchema[]
}

export interface ContractViolation {
  contractId: string
  violationType: ContractViolationType
  fieldName?: string
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW'
  description: string
}

export interface ValidationResult {
  contractId: string
  isValid: boolean
  violations: ContractViolation[]
  breakingChangeDetected: boolean
  recommendation: string
}

interface AuditEntry {
  timestamp: string
  action: string
  contractId: string
  detail: Record<string, unknown>
}

export class RealtimeApiContractValidator {
  private contracts = new Map<string, ApiContract>()
  private auditLog: AuditEntry[] = []

  registerContract(contract: ApiContract): void {
    this.contracts.set(contract.contractId, contract)
    this.appendAudit('contract.register', contract.contractId, { serviceName: contract.serviceName, version: contract.version })
  }

  validate(contractId: string, payload: Record<string, unknown>): ValidationResult {
    const contract = this.contracts.get(contractId)
    if (!contract) throw new Error(`Unknown contract: ${contractId}`)

    const violations: ContractViolation[] = []

    for (const field of contract.schema) {
      const value = payload[field.fieldName]

      // 필수 필드 ��락
      if (field.required && (value === undefined || value === null)) {
        violations.push({
          contractId,
          violationType: 'MISSING_FIELD',
          fieldName: field.fieldName,
          severity: 'CRITICAL',
          description: `필수 필드 ${field.fieldName} 누락`,
        })
        continue
      }

      if (value === undefined || value === null) continue

      // 타입 불일치 검사
      const actualType = Array.isArray(value) ? 'array' : typeof value as FieldType
      if (actualType !== field.type) {
        violations.push({
          contractId,
          violationType: 'TYPE_MISMATCH',
          fieldName: field.fieldName,
          severity: 'HIGH',
          description: `${field.fieldName}: 예상 타입 ${field.type}, 실제 타입 ${actualType}`,
        })
      }

      // deprecated 필드 사용
      if (field.deprecated) {
        violations.push({
          contractId,
          violationType: 'DEPRECATED_FIELD',
          fieldName: field.fieldName,
          severity: 'MEDIUM',
          description: `${field.fieldName} 필드는 deprecated — 최신 API 스펙으로 마이그레이션 필요`,
        })
      }
    }

    // 계약에 없는 추가 필드 감지
    for (const key of Object.keys(payload)) {
      const defined = contract.schema.find((f) => f.fieldName === key)
      if (!defined) {
        violations.push({
          contractId,
          violationType: 'SCHEMA_CHANGED',
          fieldName: key,
          severity: 'LOW',
          description: `미정의 필드 ${key} — 스키마 변경 감지`,
        })
      }
    }

    const breakingChangeDetected = violations.some((v) =>
      v.violationType === 'MISSING_FIELD' || v.violationType === 'TYPE_MISMATCH'
    )

    const isValid = violations.filter((v) => v.severity === 'CRITICAL' || v.severity === 'HIGH').length === 0

    const recommendation =
      !isValid ? '계약 위반 수정 후 배포 필요' :
      violations.length > 0 ? 'MEDIUM/LOW 위반 항목 정리 권고' :
      'API 계약 준수 양호'

    this.appendAudit('contract.validate', contractId, { isValid, violationCount: violations.length, breakingChangeDetected })

    return { contractId, isValid, violations, breakingChangeDetected, recommendation }
  }

  getAuditLog(): AuditEntry[] {
    return [...this.auditLog]
  }

  private appendAudit(action: string, contractId: string, detail: Record<string, unknown>): void {
    this.auditLog.push({ timestamp: new Date().toISOString(), action, contractId, detail })
  }
}
