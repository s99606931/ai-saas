# SVC-AI-ADV-R162 — API 의존성 그래프 분석기 (Design)

> 작성일: 2026-04-12 | 버전: 1.0.0

## 타입

```typescript
export enum DataGrade { C = 'C', S = 'S', O = 'O' }

export interface APIService { id: string; name: string; team: string }

export interface CycleReport { detected: boolean; cycles: string[][] }

export interface SPOFReport { services: Array<{ id: string; inDegree: number }> }

export interface ImpactReport {
  changedService: string
  directDependents: string[]
  transitiveImpact: string[]
  totalImpacted: number
}

export interface GraphReport {
  totalServices: number
  totalEdges: number
  cycles: CycleReport
  spof: SPOFReport
  analysisAt: number
}

class APIDependencyGraphAnalyzer {
  constructor(grade: DataGrade)
  registerService(service: APIService): void
  addDependency(from: string, to: string): void
  analyzeGraph(): GraphReport
  analyzeImpact(serviceId: string): ImpactReport
  getAuditLog(): readonly AuditEntry[]
}
```

## 알고리즘

- 그래프: Map<id, Set<id>> 인접 리스트
- 순환: DFS + recursionStack 배열 (경로 추적)
- SPOF: in-degree 계산, 상위 3개 반환
- 영향도: BFS (to→from 역방향 그래프)
