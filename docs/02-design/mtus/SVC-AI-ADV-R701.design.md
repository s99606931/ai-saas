# SVC-AI-ADV-R701 Design — AI기반 공공 입찰 평가 자동화 v2

## Executive Summary
| 관점 | 내용 |
|------|------|
| 기능 | Plan FR-R701.1~5 구현 |
| 보안 | N2SF N-05 C/S 차단, 사업자등록번호 sha256 16자, CSAP D-06 감사 |
| 품질 | TypeScript strict, Vitest 6+ |
| 범위 | platform/services/ai-service/src/lib/public-tender-evaluator-ai-v2.ts |

## 설계 결정
- `PublicTenderEvaluatorAIV2` 클래스
- `addCriterion({criterionId, weight})` weight 합 ≤1.0 검증
- `submitBid({bidId, bizRegNo, scores}, grade?)`: C/S 차단, scores는 등록된 기준만 사용
- 총점 = Σ(scores[c] × weight[c]) (0~100 범위)
- 등급: ≥80 PASS / ≥60 BORDER / 그 외 FAIL
- `rank(topN)`: 총점 내림차순 정렬
- 감사 로그는 마스킹 bizRegNo만 저장

## 변경 이력
| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0 | 2026-04-14 | 최초 작성 | ai-impl-c |
