# SVC-AI-ADV-R348 Design: AI기반 멀티클라우드 정책 자동 적용

## 핵심 알고리즘

### 컴플라이언스 점수
- VIOLATION_DEDUCTION: { critical: 25, high: 15, medium: 8, low: 3 }
- complianceScore = max(0, 100 - sum(deductions))

### 정책 위반 탐지
- resource 속성이 policy 허용 범위 초과 시 위반

## 인터페이스 설계

```typescript
class MulticloudPolicyEnforcerAI {
  registerCloud(id, name, provider): void
  registerPolicy(id, name, ruleType, severity, limit): void
  evaluateResource(cloudId, resourceType, value, grade?): PolicyEvalResult
  getComplianceScore(cloudId): number
  getAuditLog(): AuditEntry[]
}

interface PolicyEvalResult {
  cloudId: string
  resourceType: string
  value: number
  violations: PolicyViolation[]
  complianceScore: number
}
```
