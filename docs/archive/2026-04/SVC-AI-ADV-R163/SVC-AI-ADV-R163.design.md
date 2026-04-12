# SVC-AI-ADV-R163 — 설정 드리프트 감지기 (Design)

> 작성일: 2026-04-12 | 버전: 1.0.0

## 타입

```typescript
export enum DataGrade { C = 'C', S = 'S', O = 'O' }
export type DriftRisk = 'low' | 'medium' | 'high'

export interface DriftChange {
  field: string
  type: 'added' | 'modified' | 'removed'
  baseline: unknown
  current: unknown
  risk: DriftRisk
}

export interface DriftReport {
  configId: string
  changes: DriftChange[]
  totalChanges: number
  highRiskCount: number
  analysisAt: number
}

class ConfigDriftDetector {
  constructor(grade: DataGrade)
  setBaseline(configId: string, config: Record<string, unknown>): void
  detect(configId: string, current: Record<string, unknown>): DriftReport
  addWhitelistField(field: string): void
  getAuditLog(): readonly AuditEntry[]
}
```

## 알고리즘

- 재귀 딥 비교: 베이스라인 vs 현재 설정 키 순회
- risk 분류: 키 이름에 secret/password/key/token/credential 포함 → high, port/host/url → medium, 그 외 → low
- 시크릿 값 마스킹: DriftChange.baseline/current 에서 high risk 필드 → "[MASKED]"
- 화이트리스트 필드: detect 시 제외
