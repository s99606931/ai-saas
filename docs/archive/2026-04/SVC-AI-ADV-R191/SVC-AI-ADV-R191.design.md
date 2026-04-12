# SVC-AI-ADV-R191 — 민원 자동 분류/배분기 (Design)

> 작성일: 2026-04-12 | 버전: 1.0.0

## 타입

```typescript
export type DataGrade = 'C' | 'S' | 'O'
export type ComplaintPriority = 'URGENT' | 'HIGH' | 'NORMAL' | 'LOW'
export interface ComplaintCategory { categoryId: string; name: string; keywords: string[]; department: string }
export interface Complaint { complaintId: string; title: string; body: string; grade?: DataGrade }
export interface ClassifiedComplaint { complaintId: string; categoryId: string; department: string; priority: ComplaintPriority; confidence: number }
class ComplaintAutoRouter {
  registerCategory(cat: ComplaintCategory): void
  classify(complaint: Complaint): ClassifiedComplaint
  getAuditLog(): AuditEntry[]
}
```

## 알고리즘
- 분류: 각 카테고리 키워드 매칭 수 계산 → 최다 매칭 카테고리 선택
- confidence: matchCount / totalKeywords (0~1)
- priority: '긴급'|'즉시' 포함→URGENT, confidence≥0.5→HIGH, ≥0.2→NORMAL, else→LOW
