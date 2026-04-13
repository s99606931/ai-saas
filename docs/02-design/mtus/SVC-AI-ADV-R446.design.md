# SVC-AI-ADV-R446 Design — policy-compliance-verifier-v2.ts

Plan Ref: SVC-AI-ADV-R446.plan.md

## 클래스 설계

```typescript
type ComplianceResult = 'pass' | 'fail' | 'partial'

class PolicyComplianceVerifierV2 {
  registerPolicy(policyId, name, category, mandatory): Policy
  recordComplianceResult(policyId, result, dataGrade?): void
  getComplianceRate(): number  // 0-100
  getNonCompliantMandatoryPolicies(): Policy[]
  getAuditLog(): AuditEntry[]
}
```

## 준수율 공식
`rate = (pass 수 / 전체 기록 수) * 100`

기록 없으면 100 반환

## 미준수 필수 정책
`mandatory === true` AND 해당 정책 최신 결과가 `pass`가 아닌 경우
