# SVC-AI-ADV-R275 — 설계

## 구조

```
startOnboarding(tenantId, plan)
completeStep(tenantId, step, data)
  steps: 'basic_info' | 'admin_user' | 'domain' | 'sso' | 'billing'
  each with validators
finalize(tenantId) → 모든 단계 완료 시만 ACTIVE
getStatus(tenantId) → {step 현재, 진행률, 활성화 여부}
```
