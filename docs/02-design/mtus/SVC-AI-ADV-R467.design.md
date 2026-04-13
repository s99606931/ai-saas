# SVC-AI-ADV-R467 Design — public-input-validator-v2.ts

Plan Ref: SVC-AI-ADV-R467.plan.md

## 클래스 설계

```typescript
type RuleType = 'required' | 'minLength' | 'maxLength' | 'pattern'

class PublicInputValidatorV2 {
  addRule(ruleId, fieldName, ruleType, ruleValue, dataGrade?): ValidationRule
  validate(fieldName, value): ValidationResult
  getFieldRules(fieldName): ValidationRule[]
  getAuditLog(): AuditEntry[]
}

interface ValidationResult {
  valid: boolean
  errors: string[]
}
```

## 규칙 적용
- required: value가 빈 문자열이면 에러
- minLength: value.length < ruleValue 이면 에러
- maxLength: value.length > ruleValue 이면 에러
- pattern: new RegExp(ruleValue).test(value) 실패 시 에러
