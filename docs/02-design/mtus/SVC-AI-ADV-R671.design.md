# SVC-AI-ADV-R671 Design — AI기반 서비스 의존성 상태 관리 v3

## Executive Summary
| 관점 | 내용 |
|------|------|
| 기능 | Plan FR-R671.1~5 구현 |
| 보안 | N2SF N-05 차단, 서비스명 SHA-256, CSAP D-06 감사 |
| 품질 | TypeScript strict, Vitest 5+ |
| 범위 | platform/services/ai-service/src/lib/service-dependency-health-ai-v3.ts |

## 설계 결정
- `ServiceDependencyHealthAIV3` 클래스
- 노드: name, status, dependsOn[]
- `register(node)`, `evaluate(dataGrade?)` → 마스킹된 노드별 effectiveStatus
- 전파 규칙: 의존 대상이 DOWN이면 effectiveStatus=IMPACTED (단, 자기 자신이 DOWN이면 DOWN 유지)
- BFS로 1단계 전파만 평가 (단순화)
- audit actions: REGISTER_NODE, EVALUATE

## 변경 이력
| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0 | 2026-04-14 | 최초 작성 | ai-impl-c |
