# SVC-AI-ADV-R289 Design: AI기반 서비스 에코시스템 매핑

## 핵심 알고리즘

### 그래프 모델
- 노드: 서비스 ID → ServiceNode
- 엣지: Map<fromId, Array<{toId, weight}>>
- 이웃: 직접 연결된 toId 목록 반환

### 핵심 서비스 탐지
- 각 노드의 in-degree(자신을 참조하는 엣지 수) + out-degree 합산
- 상위 N개 반환

## 인터페이스 설계

```typescript
class ServiceEcosystemMapperAI {
  registerNode(id, name, type): void
  addEdge(fromId, toId, weight?): void
  getNeighbors(serviceId): ServiceNode[]
  getCriticalServices(topN?): CriticalServiceInfo[]
  getAuditLog(): AuditEntry[]
}

interface CriticalServiceInfo {
  id: string
  name: string
  degree: number
}
```
