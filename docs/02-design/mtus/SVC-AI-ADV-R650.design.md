# SVC-AI-ADV-R650 Design — AI기반 이벤트 드리븐 오케스트레이터 v2

## Executive Summary
| 관점 | 내용 |
|------|------|
| 기능 | Plan FR-R650.1~5 구현 |
| 보안 | N2SF N-05 C/S 차단, CSAP D-06 감사 로그 |
| 품질 | TypeScript strict, Vitest 5+ |
| 범위 | platform/services/ai-service/src/lib/event-driven-orchestrator-ai-v2.ts |

## 설계 결정
- `EventDrivenOrchestratorAIV2` 클래스
- `defineWorkflow(id, steps)`: steps = [{stepId, expectedMs}]
- `handleEvent(workflowId, event, grade)`: C/S 차단
- `recordStep(workflowId, stepId, actualMs, status)`
- `getDelayedSteps(workflowId)`: actualMs > expectedMs×1.5 반환
- 상태: PENDING/RUNNING/DONE/FAILED

## 변경 이력
| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0 | 2026-04-14 | 최초 작성 | ai-impl-c |
