# SVC-AI-ADV-R167 — 공공 민원 감정 분석기 (Design)

> 작성일: 2026-04-12 | 버전: 1.0.0

## 타입

```typescript
export type Sentiment = 'POSITIVE' | 'NEGATIVE' | 'NEUTRAL' | 'URGENT'
export type DataGrade = 'C' | 'S' | 'O'

export interface ComplaintAnalysis {
  complaintId: string; sentiment: Sentiment
  score: number; keywords: string[]; maskedText: string }

export interface DepartmentSentimentReport {
  department: string; totalComplaints: number
  sentimentBreakdown: Record<Sentiment, number>; avgScore: number }

class ComplaintSentimentAnalyzer {
  analyzeComplaint(id: string, text: string, department: string, grade?: DataGrade): ComplaintAnalysis
  getDepartmentReport(department: string): DepartmentSentimentReport
  getAuditLog(): AuditEntry[]
}
```

## 알고리즘

- N2SF: C/S 등급 차단
- PII 마스킹: 주민번호, 전화번호, 이메일 정규식 치환
- 감정 분류 (키워드 점수합):
  - URGENT 키워드(긴급/즉시/위험/사고/생명): 합계 > 0 → URGENT
  - NEGATIVE 키워드(불만/문제/오류/민원/항의): 합계 > POSITIVE 합계 → NEGATIVE
  - POSITIVE 키워드(감사/만족/좋음/칭찬/우수): 합계 > 0 → POSITIVE
  - else → NEUTRAL
- score: (매칭 키워드 수 / 전체 토큰 수).clamp(0, 1)
