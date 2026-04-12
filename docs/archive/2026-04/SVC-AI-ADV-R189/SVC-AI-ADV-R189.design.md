# SVC-AI-ADV-R189 — 정책 문서 요약기 (Design)

> 작성일: 2026-04-12 | 버전: 1.0.0

## 타입

```typescript
export type DataGrade = 'C' | 'S' | 'O'
export interface PolicyDoc { docId: string; title: string; body: string; category: string; grade: DataGrade }
export interface DocSummary { docId: string; title: string; keywords: string[]; keySentences: string[]; summary: string }
class PolicyDocSummarizer {
  registerDoc(doc: PolicyDoc): void         // C/S 차단
  summarize(docId: string, topN?: number): DocSummary
  getAuditLog(): AuditEntry[]
}
```

## 알고리즘
- 문장 분리: `[.!?。\n]+` split
- 단어 빈도: 2글자+ 토큰 frequency map
- keySentences: 문장 내 고빈도 단어 점수 상위 topN (기본 3)
- keywords: 빈도 상위 5개
- summary: `총 N문장. 주요 키워드: k1, k2, ...`
