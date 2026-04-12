# SVC-AI-ADV-R193 — 공공 데이터 품질 검사기 (Design)

> 작성일: 2026-04-12 | 버전: 1.0.0

## 타입

```typescript
export type FieldType = 'string' | 'number' | 'date' | 'boolean'
export interface FieldSchema { name: string; type: FieldType; required: boolean; pattern?: string }
export interface DatasetSchema { schemaId: string; name: string; fields: FieldSchema[] }
export interface ValidationError { row: number; field: string; value: unknown; reason: string }
export interface QualityReport { schemaId: string; totalRows: number; validRows: number; completenessScore: number; validityScore: number; errors: ValidationError[] }
class PublicDataQualityChecker {
  registerSchema(schema: DatasetSchema): void
  validate(schemaId: string, rows: Record<string, unknown>[]): QualityReport
  getAuditLog(): AuditEntry[]
}
```

## 알고리즘
- completeness: 필수 필드 모두 존재하는 행 / 전체 행
- validity: 타입+패턴 모두 유효한 행 / 전체 행
- 타입 검사: typeof + Date.parse + number isFinite
