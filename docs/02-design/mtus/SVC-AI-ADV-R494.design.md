# SVC-AI-ADV-R494 Design — service-ecosystem-mapper-v2.ts

Plan Ref: SVC-AI-ADV-R494.plan.md

## 클래스 설계

```typescript
class ServiceEcosystemMapperV2 {
  registerNode(nodeId, name, serviceType): ServiceNode
  addDependency(fromId, toId, dependencyType, dataGrade?): void
  getServiceDependencies(nodeId): Dependency[]
  getHighDependencyNodes(threshold): ServiceNode[]  // inbound dependency count >= threshold
  getAuditLog(): AuditEntry[]
}
```

## 의존성 집계
`inboundCount[nodeId]` = addDependency 호출에서 toId가 nodeId인 횟수
