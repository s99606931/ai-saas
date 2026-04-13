# SVC-AI-ADV-R369 Design: 서비스 의존성 건전성 모니터

## 핵심 알고리즘
- 노드: { id, name, status: HEALTHY|DEGRADED|DOWN }
- edges: Map<from, Set<to>>
- downstream(id) = DFS 순회로 도달 가능한 모든 노드
- risk = f(downstream.length, DOWN 비율)
  - DOWN 비율 >= 0.5 → CRITICAL
  - DOWN 비율 >= 0.25 → HIGH
  - DEGRADED 존재 → MEDIUM
  - 그 외 → LOW

## 클래스
```typescript
class ServiceDependencyHealthMonitor {
  registerNode(id, name): void
  setStatus(id, status): void
  addDependency(from, to): void
  analyzeDownstream(id): string[]
  classifyRisk(id): DependencyRisk
  getAuditLog(): AuditEntry[]
}
```

## CSAP D-06
- 모든 register/setStatus/addDependency 이벤트 기록
