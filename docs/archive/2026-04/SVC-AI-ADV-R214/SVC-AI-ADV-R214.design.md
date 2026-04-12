# SVC-AI-ADV-R214 — 크로스 서비스 의존성 분석기 Design

> 작성일: 2026-04-12 | 버전: 1.0.0

## 컴포넌트 설계

```
CrossServiceDependencyAnalyzer
├── registerService(id, name, metadata)
├── addDependency(fromId, toId, type)
├── detectCycles(): CycleResult[]          // DFS 재귀 스택 활용
├── getCriticalPath(startId): string[]     // BFS 최장 경로
├── getImpactedServices(serviceId): string[] // BFS 전파
└── getAuditLog(): AuditEntry[]
```

## 핵심 알고리즘

- **사이클 탐지**: DFS + 재귀 스택(visiting set), 사이클 경로 반환
- **임팩트 분석**: BFS로 의존 서비스 전파 (distance 추적)
- **중요도**: in-degree 기반 SPOF 판별 (in-degree ≥ 3)

## CSAP D-08 준수

- N2SF DataGrade guard: C/S 등급 차단
- 모든 작업 감사 로그 기록
