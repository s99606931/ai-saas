# SVC-AI-ADV-R474 Design — cloud-migration-planner-v2.ts

Plan Ref: SVC-AI-ADV-R474.plan.md

## 클래스 설계

```typescript
type TechStack = 'legacy' | 'modern' | 'cloud-native'
type MigrationStrategy = 'refactor' | 'replatform' | 'rehost'

const TECH_STACK_SCORE: Record<TechStack, number> = { legacy: 30, modern: 15, 'cloud-native': 5 }

class CloudMigrationPlannerV2 {
  registerSystem(systemId, name, techStack): MigrationSystem
  addDependencies(systemId, dependencyCount, dataGrade?): void
  getComplexityScore(systemId): number   // min(100, deps*10 + techScore)
  getMigrationStrategy(systemId): MigrationStrategy
  getAuditLog(): AuditEntry[]
}
```

## 전략 기준
>=70: refactor, >=40: replatform, else rehost
