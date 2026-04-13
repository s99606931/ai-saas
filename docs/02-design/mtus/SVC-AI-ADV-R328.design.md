# SVC-AI-ADV-R328 Design: AI기반 코드 보안 정책 자동 적용

## 핵심 알고리즘

### 보안 점수 계산
- SEVERITY_DEDUCTION: { critical: 30, high: 15, medium: 7, low: 2 }
- securityScore = max(0, 100 - sum(deduction per violation))

### 위반 분류
- 정책 매칭: violation.ruleType === policy.ruleType
- 미매칭 위반: 'unknown' 정책으로 처리

## 인터페이스 설계

```typescript
class CodeSecurityPolicyEnforcer {
  registerPolicy(id, name, ruleType, severity): void
  scanCode(scanId, fileName, violations: Array<{ruleType, line}>, grade?): ScanResult
  getSecurityScore(scanId): number
  getViolationsByPolicy(policyId): PolicyViolation[]
  getAuditLog(): AuditEntry[]
}

interface ScanResult {
  scanId: string
  fileName: string
  securityScore: number
  violations: PolicyViolation[]
}

interface PolicyViolation {
  scanId: string
  policyId: string
  ruleType: string
  severity: 'critical' | 'high' | 'medium' | 'low'
  line: number
}
```
