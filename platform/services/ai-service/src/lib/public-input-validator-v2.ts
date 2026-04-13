// Plan SC: SVC-AI-ADV-R467
// Design Ref: §규칙적용 — required/minLength/maxLength/pattern 순차 검증
type RuleType = 'required' | 'minLength' | 'maxLength' | 'pattern'
type DataGrade = 'O' | 'C' | 'S'

interface ValidationRule { ruleId: string; fieldName: string; ruleType: RuleType; ruleValue: string }
interface ValidationResult { valid: boolean; errors: string[] }
interface AuditEntry { action: string; detail: string; timestamp: string }

export class PublicInputValidatorV2 {
  private rules: ValidationRule[] = []
  private auditLog: AuditEntry[] = []

  private checkGrade(grade?: DataGrade): void {
    if (grade === 'C' || grade === 'S') throw new Error(`BLOCKED: ${grade}등급 데이터는 AI API 전송 금지 (N2SF N-05)`)
  }
  private log(action: string, detail: string): void {
    this.auditLog.push({ action, detail, timestamp: new Date().toISOString() })
  }

  addRule(ruleId: string, fieldName: string, ruleType: RuleType, ruleValue: string, dataGrade?: DataGrade): ValidationRule {
    this.checkGrade(dataGrade)
    const rule: ValidationRule = { ruleId, fieldName, ruleType, ruleValue }
    this.rules.push(rule)
    this.log('rule.add', `ruleId=${ruleId} fieldName=${fieldName} type=${ruleType}`)
    return rule
  }

  validate(fieldName: string, value: string): ValidationResult {
    const fieldRules = this.rules.filter((r) => r.fieldName === fieldName)
    const errors: string[] = []
    for (const rule of fieldRules) {
      switch (rule.ruleType) {
        case 'required':
          if (!value || value.trim() === '') errors.push(`${fieldName}: 필수 입력 항목입니다`)
          break
        case 'minLength':
          if (value.length < Number(rule.ruleValue)) errors.push(`${fieldName}: 최소 ${rule.ruleValue}자 이상 입력하세요`)
          break
        case 'maxLength':
          if (value.length > Number(rule.ruleValue)) errors.push(`${fieldName}: 최대 ${rule.ruleValue}자 이하로 입력하세요`)
          break
        case 'pattern':
          if (!new RegExp(rule.ruleValue).test(value)) errors.push(`${fieldName}: 형식이 올바르지 않습니다`)
          break
      }
    }
    this.log('validate', `fieldName=${fieldName} valid=${errors.length === 0}`)
    return { valid: errors.length === 0, errors }
  }

  getFieldRules(fieldName: string): ValidationRule[] {
    return this.rules.filter((r) => r.fieldName === fieldName)
  }

  getAuditLog(): AuditEntry[] { return [...this.auditLog] }
}
