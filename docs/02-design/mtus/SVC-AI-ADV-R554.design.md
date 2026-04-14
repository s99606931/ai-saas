# SVC-AI-ADV-R554 Design — deployment-rollback-optimizer-v2.ts
Plan Ref: SVC-AI-ADV-R554.plan.md
## 클래스 설계
```typescript
type DeployStatus = 'running' | 'failed' | 'rolled-back'
class DeploymentRollbackOptimizerV2 {
  registerDeployment(deployId, serviceId, version, deployedAt): Deployment
  updateStatus(deployId, status, errorRate, dataGrade?): void
  needsRollback(deployId): boolean  // errorRate > 5
  getRollbackCandidates(): Deployment[]
  getAuditLog(): AuditEntry[]
}
```
