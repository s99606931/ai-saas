# SVC-AI-ADV-R382 Design: AI기반 공공 서비스 접근성 자동 평가 v2

## 핵심 알고리즘

### 접근성 점수
- `accessibilityScore = avg(score for all evaluated items)`
- 미통과 항목 심각도: score < 40 → critical, < 70 → major, < 90 → minor, >= 90 → pass

## 클래스 설계

```typescript
class PublicAccessibilityAutoEvaluator {
  registerService(id, name, serviceType): void
  recordEvaluation(serviceId, itemId, passed, score, grade): void
  getAccessibilityScore(serviceId): number
  getIssues(serviceId): AccessibilityIssue[]
  getAuditLog(): AuditEntry[]
}
```

## N2SF / CSAP 적용
- C/S 등급: recordEvaluation 차단
- 감사 로그: service.register, evaluation.record
