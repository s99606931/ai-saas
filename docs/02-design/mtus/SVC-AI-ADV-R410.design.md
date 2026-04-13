# SVC-AI-ADV-R410 Design: AI기반 공공 민원 우선순위 분류 v3

## 핵심 알고리즘

### 긴급도 점수
- URGENT_KEYWORDS: ["긴급", "위험", "사망", "화재", "사고"] → +30점 각
- 기본 점수: 10점
- `urgencyScore = 10 + count(matchedKeywords) * 30`
- 최대 100점 (cap)

### PII 마스킹
- submitterId: SHA-256 → 16자 hex

## 클래스 설계

```typescript
class ComplaintPriorityClassifierV3 {
  submitComplaint(id, content, submitterId, grade): ComplaintEntry
  getPriorityQueue(): ComplaintEntry[]  // urgencyScore 내림차순
  markCompleted(complaintId): void
  getAuditLog(): AuditEntry[]
}
```
