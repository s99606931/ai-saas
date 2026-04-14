# SVC-AI-ADV-R681 Design — AI기반 민원인 피드백 루프 v3

## Executive Summary
| 관점 | 내용 |
|------|------|
| 기능 | Plan FR-R681.1~5 구현 |
| 보안 | N2SF N-05 C/S 차단, PII sha256 마스킹, CSAP D-06 감사 로그 |
| 품질 | TypeScript strict, Vitest 5+ |
| 범위 | platform/services/ai-service/src/lib/citizen-feedback-loop-ai-v3.ts |

## 설계 결정
- `CitizenFeedbackLoopAIV3` 클래스
- `registerChannel(ch)`, `submitFeedback(fb, grade)`: C/S 차단
- 우선순위 점수 = sentimentNegativity * channel.weight
- 점수: ≥0.8 URGENT / ≥0.5 HIGH / NORMAL
- 권고: URGENT→ESCALATE / HIGH→REVIEW / NORMAL→QUEUE
- citizenId는 sha256 16자 마스킹 후 저장
- 첨부 영향도 high 시 권고 한 단계 승격

## 변경 이력
| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0 | 2026-04-14 | 최초 작성 | ai-impl-c |
