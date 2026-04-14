# SVC-AI-ADV-R509 Design — public-data-standardizer-v2.ts

Plan Ref: SVC-AI-ADV-R509.plan.md

## 클래스 설계

```typescript
interface SchemaField { name: string; type: string; required: boolean }
interface ValidationResult { valid: boolean; errors: string[] }

class PublicDataStandardizerV2 {
  registerSchema(schemaId, name, fields[]): DataSchema
  validateRecord(schemaId, record{}, dataGrade?): ValidationResult
  getValidationStats(schemaId): { total: number; passed: number; failed: number }
  getAuditLog(): AuditEntry[]
}
```

## 검증 규칙
required 필드 누락 → error, type 불일치 → error
