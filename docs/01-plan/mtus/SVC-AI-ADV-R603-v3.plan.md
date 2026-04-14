# SVC-AI-ADV-R603 (v3) Plan — AI기반 서비스 의존성 매핑 v3

## Context Anchor
| 항목 | 내용 |
|------|------|
| WHY | 서비스 호출 그래프에서 직간접 의존 관계 자동 도출하여 변경 영향 분석 지원 |
| WHO | 플랫폼 아키텍트, SRE |
| RISK | 순환 의존 미탐지로 인한 장애 전파 방지 |
| SUCCESS | SC-R603v3-1: 정점/간선 등록 / SC-R603v3-2: 영향 노드 집계 / SC-R603v3-3: 순환 탐지 |
| SCOPE | service-dependency-mapper-v3.ts 구현 (트랙 A 22차) |

## 기능 요구사항
- FR-R603v3.1: 입력 (services: string[], edges: {from, to}[])
- FR-R603v3.2: 자기 참조 간선 무시
- FR-R603v3.3: 특정 서비스 변경 시 BFS로 영향받는 서비스 목록 반환
- FR-R603v3.4: DFS 순환 탐지 (`hasCycles`, `cycles: string[][]`)
- FR-R603v3.5: 감사 로그 기록

## 추적성
FR-R603v3.* ↔ `service-dependency-mapper-v3.ts` ↔ 테스트 ↔ CSAP D-12
