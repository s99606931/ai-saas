# SVC-AI-ADV-R450 Plan — 공공 서비스 품질 벤치마크 AI

## Executive Summary
| 관점 | 내용 |
|------|------|
| WHY | 기관간 서비스 품질 자동 비교 순위화 |
| WHO | 행안부, 기관 평가관 |
| WHAT | 기관별 품질 지표 → 가중 점수 + 순위 |
| HOW | 정규화 + 가중합 + 순위 정렬 |

## Context Anchor
- WHY: 기관간 공정한 비교
- WHO: 정책 평가관
- RISK: 지표 차등 → 투명 가중치 공개
- SUCCESS: 10개 이상 기관 순위 산출
- SCOPE: `public-service-quality-benchmark-ai.ts`

## 요구사항
- FR-450.1: Agency = { id, metrics: { satisfaction, response, coverage, transparency } } (각 0..100)
- FR-450.2: 가중치: satisfaction=0.4, response=0.2, coverage=0.2, transparency=0.2
- FR-450.3: score = 가중합 (0..100)
- FR-450.4: rankings = score 내림차순, 동점 시 satisfaction desc
- FR-450.5: N2SF C/S 차단 + `getAuditLog()`

## 추적성
FR-450.* ↔ `public-service-quality-benchmark-ai.ts` ↔ 테스트 ↔ CSAP D-06 N2SF N-05
