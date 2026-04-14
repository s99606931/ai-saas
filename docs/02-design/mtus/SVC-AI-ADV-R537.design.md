# SVC-AI-ADV-R537 Design — api-lifecycle-optimizer-v2.ts
Plan Ref: SVC-AI-ADV-R537.plan.md
## 클래스 설계
```typescript
type ApiStatus = 'active' | 'deprecated' | 'retired'
class ApiLifecycleOptimizerV2 {
  registerApi(apiId, version, status, releaseDate): ApiVersion
  recordUsage(apiId, callCount, errorCount, dataGrade?): void
  getHealthScore(apiId): number  // max(0, (1 - errorCount/totalCalls)*100), 호출 없으면 100
  getDeprecatedApis(): ApiVersion[]  // status=deprecated
  getAuditLog(): AuditEntry[]
}
```
