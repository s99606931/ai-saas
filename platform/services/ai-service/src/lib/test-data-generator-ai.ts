// Design Ref: §R196 — AI기반 테스트 데이터 자동 생성
// Plan SC: SVC-AI-ADV-R196-SC01

export type FieldType = 'string' | 'number' | 'boolean' | 'date' | 'email' | 'phone' | 'uuid'
export type DataGrade = 'C' | 'S' | 'O'

export interface FieldSpec {
  name: string
  type: FieldType
  nullable?: boolean
  minLength?: number
  maxLength?: number
  min?: number
  max?: number
}

export interface SchemaSpec {
  schemaId: string
  name: string
  fields: FieldSpec[]
  grade?: DataGrade
}

export interface GeneratedRecord {
  [key: string]: string | number | boolean | null
}

export interface GenerationResult {
  schemaId: string
  count: number
  records: GeneratedRecord[]
  generatedAt: string
}

interface AuditEntry {
  timestamp: string
  action: string
  schemaId: string
  detail: Record<string, unknown>
}

const SAMPLE_STRINGS: Record<number, string> = {
  4: '테스트',
  6: '샘플값',
  8: '테스트데이터',
  10: '샘플테스트값A',
}

function generateStringValue(field: FieldSpec, seed: number): string {
  const len = field.minLength ?? 4
  return SAMPLE_STRINGS[len] ?? `test_${field.name}_${seed}`
}

function generateValue(field: FieldSpec, index: number): string | number | boolean | null {
  if (field.nullable && index % 7 === 0) return null
  switch (field.type) {
    case 'number': {
      const min = field.min ?? 0
      const max = field.max ?? 1000
      return min + (index % (max - min + 1))
    }
    case 'boolean':
      return index % 2 === 0
    case 'date':
      return new Date(2026, 0, 1 + (index % 28)).toISOString().split('T')[0]!
    case 'email':
      return `user${index}@example.com`
    case 'phone':
      return `010-${String(1000 + index).padStart(4, '0')}-${String(2000 + index).padStart(4, '0')}`
    case 'uuid':
      return `00000000-0000-0000-0000-${String(index).padStart(12, '0')}`
    default:
      return generateStringValue(field, index)
  }
}

export class TestDataGeneratorAi {
  private schemas = new Map<string, SchemaSpec>()
  private auditLog: AuditEntry[] = []

  registerSchema(spec: SchemaSpec): void {
    // N2SF: C/S 등급 스키마 생성 차단
    if (spec.grade === 'C' || spec.grade === 'S') {
      throw new Error(`BLOCKED: ${spec.grade}등급 스키마는 테스트 데이터 생성 금지 (N2SF N-05)`)
    }
    this.schemas.set(spec.schemaId, spec)
    this.appendAudit('schema.register', spec.schemaId, { name: spec.name })
  }

  generate(schemaId: string, count: number): GenerationResult {
    const schema = this.schemas.get(schemaId)
    if (!schema) throw new Error(`Unknown schema: ${schemaId}`)
    if (count <= 0) throw new Error('count는 1 이상이어야 합니다')

    const records: GeneratedRecord[] = []
    for (let i = 0; i < count; i++) {
      const record: GeneratedRecord = {}
      for (const field of schema.fields) {
        record[field.name] = generateValue(field, i)
      }
      records.push(record)
    }

    this.appendAudit('data.generate', schemaId, { count })

    return {
      schemaId,
      count,
      records,
      generatedAt: new Date().toISOString(),
    }
  }

  getAuditLog(): AuditEntry[] {
    return [...this.auditLog]
  }

  private appendAudit(action: string, schemaId: string, detail: Record<string, unknown>): void {
    this.auditLog.push({ timestamp: new Date().toISOString(), action, schemaId, detail })
  }
}
