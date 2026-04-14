# SVC-AI-ADV-R695 Design — AI기반 문서 워크플로우 자동화 v3

## Executive Summary
| 관점 | 내용 |
|------|------|
| 기능 | Plan FR-R695.1~5 구현 |
| 보안 | N2SF N-05 C/S 차단, PII sha256 마스킹, CSAP D-06 감사 로그 |
| 품질 | TypeScript strict, Vitest 5+ |
| 범위 | platform/services/ai-service/src/lib/document-workflow-ai-v3.ts |

## 설계 결정
- `DocumentWorkflowAIV3` 클래스
- `registerTemplate(tpl)`, `draftDocument(doc, grade)`: C/S 차단
- 진행률 = completedSteps/totalSteps*100
- 상태: progress === 100 → DONE / pendingDays > 7 → STALLED / ACTIVE
- drafterId sha256 16자 마스킹

## 변경 이력
| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0 | 2026-04-14 | 최초 작성 | ai-impl-b |
