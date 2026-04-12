# SVC-AI-ADV-R108-microservice — Microservice Dependency Analyzer (Design)

> 작성일: 2026-04-12 | Plan: SVC-AI-ADV-R108-microservice.plan.md

## 1. 아키텍처

```
registerService / addDependency
        ↓
MicroserviceDependencyAnalyzer
  ├─ ServiceGraph (방향성 인접 리스트)
  ├─ detectCycles() — DFS + 회색 노드 추적
  ├─ getImpactPath() — BFS 역방향 탐색
  ├─ exportGraph() — JSON 직렬화
  └─ getAuditLog() — append-only 배열
```

## 2. 타입 정의

```typescript
export type DependencyType = 'SYNC' | 'ASYNC' | 'OPTIONAL'

export interface ServiceMetadata {
  serviceId: string
  description?: string
  team?: string
  criticality?: 'HIGH' | 'MEDIUM' | 'LOW'
}

export interface Dependency {
  from: string
  to: string
  type: DependencyType
  registeredAt: string
}

export interface CycleReport {
  cycle: string[]
  length: number
  detectedAt: string
}

export interface GraphExport {
  services: ServiceMetadata[]
  dependencies: Dependency[]
  exportedAt: string
}

export interface AuditEntry {
  timestamp: string
  action: string
  detail: Record<string, unknown>
}
```

## 3. 알고리즘

### §3.1 순환 탐지 (DFS)
- 색상 마킹: WHITE(미방문) / GRAY(방문중) / BLACK(완료)
- GRAY 노드 재방문 시 순환 확인
- 경로 스택으로 순환 구간 추출

### §3.2 영향 경로 (BFS)
- 역방향 그래프 구성 (to → from 역전)
- BFS로 모든 간접 의존 서비스 수집

## 4. Design Anchor

- CSAP D-06: 모든 서비스 등록/의존성 변경 감사 로그
- 순수 계산 — 외부 API 없음
