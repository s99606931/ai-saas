# SVC-AI-ADV-R548 Design — cloud-native-app-optimizer-v2.ts
Plan Ref: SVC-AI-ADV-R548.plan.md
## 클래스 설계
```typescript
type Recommendation = 'scale-up' | 'scale-down' | 'optimal'
class CloudNativeAppOptimizerV2 {
  registerApp(appId, name, framework, replicaCount): CloudApp
  recordUsage(appId, cpuPercent, memPercent, dataGrade?): void
  getOptimizationRecommendation(appId): Recommendation  // cpu>70||mem>70:scale-up, cpu<30&&mem<30:scale-down, else optimal
  getOverProvisionedApps(): CloudApp[]
  getAuditLog(): AuditEntry[]
}
```
