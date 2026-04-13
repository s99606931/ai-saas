# SVC-AI-ADV-R379 Design: AI기반 공공기관 감사 자동화 v2

## 핵심 알고리즘

### 통과율 계산
- `passRate = passedCount / totalCount * 100` (카테고리별)
- 필수 항목(required=true) 중 미통과 항목 별도 집계

### 감사 결과
- AuditItemResult: { itemId, passed, evidence, timestamp }
- getFailedRequiredItems(): required=true AND passed=false

## 클래스 설계

```typescript
class PublicAuditAutomationV2 {
  registerItem(id, name, category, required): void
  recordResult(itemId, passed, evidence, grade): void
  getCategoryPassRate(category): number
  getFailedRequiredItems(): AuditItem[]
  getAuditLog(): AuditEntry[]
}
```

## N2SF / CSAP 적용
- C/S 등급: recordResult 차단
- 감사 로그: item.register, result.record
