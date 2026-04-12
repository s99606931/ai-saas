# SVC-AI-ADV-R168 — 데이터 마스킹 자동화 (Design)

> 작성일: 2026-04-12 | 버전: 1.0.0

## 타입

```typescript
export interface MaskingPattern {
  patternId: string; name: string
  regex: string; replacement: string; priority: number }

export interface MaskingResult {
  original: string; masked: string
  appliedPatterns: string[]; maskCount: number }

export interface MaskingStats {
  patternId: string; name: string; totalApplied: number }

class DataMaskingAutomator {
  registerPattern(pattern: MaskingPattern): void
  maskText(text: string): MaskingResult
  maskRecord(record: Record<string, string>, sensitiveFields: string[]): Record<string, string>
  getStats(): MaskingStats[]
  getAuditLog(): AuditEntry[]
}
```

## 알고리즘

- 기본 패턴 (priority 순 적용):
  - RRN: `/\d{6}-\d{7}/g` → `######-#######`
  - 전화: `/01[016-9]-\d{3,4}-\d{4}/g` → `010-****-####`
  - 이메일: `/[\w.+-]+@[\w-]+\.\w+/g` → `****@***`
  - 카드번호: `/\d{4}-\d{4}-\d{4}-\d{4}/g` → `****-****-****-####`
- maskRecord: sensitiveFields 목록의 키 값을 maskText로 처리
- stats: 패턴별 누적 적용 횟수 추적
