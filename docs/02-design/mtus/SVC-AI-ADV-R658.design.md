# SVC-AI-ADV-R658 Design — AI기반 데이터 메시 코디네이터 v2

## Executive Summary
| 관점 | 내용 |
|------|------|
| 기능 | Plan FR-R658.1~6 구현 |
| 보안 | N2SF N-05, PII 마스킹, CSAP D-06 |
| 품질 | TypeScript strict, Vitest 6+ |
| 범위 | platform/services/ai-service/src/lib/data-mesh-coordinator-ai-v2.ts |

## 설계 결정
- `DataMeshCoordinatorAIV2` 클래스
- 의존성 그래프 DFS로 순환 탐지
- 거버넌스 점수 = (1/3)*(오너율 + SLA율 + 메타데이터율)
- ownerHash로 PII 보호

## 변경 이력
| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0 | 2026-04-14 | 최초 작성 | ai-impl-c |
