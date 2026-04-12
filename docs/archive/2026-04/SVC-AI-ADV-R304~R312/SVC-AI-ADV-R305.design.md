# SVC-AI-ADV-R305 Design: AI기반 공공기관 민원 패턴 분석

## 핵심 알고리즘

### 처리 지연 탐지
- avgProcessingDays > targetDays * 1.2 이면 지연으로 분류
- 개선 제안: 처리시간이 긴 유형에 "담당자 증원", "자동화 검토" 제안

### PII 마스킹
- complaintId 기반 민원인 정보 비식별화 (SHA-256 → 16자)

## 인터페이스 설계

```typescript
class CitizenComplaintPatternAnalyzer {
  registerComplaintType(typeId, name, targetDays): void
  recordComplaint(typeId, complaintId, processingDays, grade?): void
  getTypeStats(typeId): ComplaintTypeStats
  getDelayedTypes(): DelayReport[]
  getAuditLog(): AuditEntry[]
}
```
