# SVC-AI-ADV-R610 Design — AI기반 워크플로우 병목 탐지 v3

## Executive Summary
| 관점 | 내용 |
|------|------|
| 기능 | Plan FR-R610.1~5 구현 |
| 보안 | N2SF N-05 C/S 차단, CSAP D-06 감사 로그 |
| 품질 | TypeScript strict, Vitest 5+개 |
| 범위 | platform/services/ai-service/src/lib/ |

## 설계 결정
- 클래스 `WorkflowBottleneckDetectorV3`, 단계별 기대시간 등록 후 실측 기록
- 실측 평균 > 기대×1.5 → BOTTLENECK / >×1.2 → WARNING / else NORMAL
- 큐 대기 > 50 또는 실측×2 초과 → CRITICAL 승격
- 담당자(assignee)는 PII 마스킹
- C/S 등급 측정값은 즉시 throw

## 변경 이력
| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0 | 2026-04-14 | 최초 작성 | ai-impl-b |
