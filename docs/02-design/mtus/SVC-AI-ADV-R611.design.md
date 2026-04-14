# SVC-AI-ADV-R611 Design — AI기반 공공 피드백 분류 v3

## Executive Summary
| 관점 | 내용 |
|------|------|
| 기능 | Plan FR-R611.1~5 구현 |
| 보안 | N2SF N-05 C/S 차단, CSAP D-06 감사 로그 |
| 품질 | TypeScript strict, Vitest 5+개 |
| 범위 | platform/services/ai-service/src/lib/ |

## 설계 결정
- 카테고리 키워드 사전으로 분류 (COMPLAINT/SUGGESTION/PRAISE/QUESTION/OTHER)
- 감성: 부정 키워드/긍정 키워드 카운트로 NEGATIVE/NEUTRAL/POSITIVE 판정
- 우선순위: 부정+COMPLAINT→HIGH / COMPLAINT→MEDIUM / else LOW
- 작성자 email/phone은 SHA-256 16자 마스킹

## 변경 이력
| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0 | 2026-04-14 | 최초 작성 | ai-impl-b |
