# SVC-AI-ADV-R428 Plan — Citizen Engagement Analyzer

## Executive Summary
| 관점 | 내용 |
|------|------|
| WHY | 정책 참여(의견/투표/댓글) 분석해 참여도 지수 산출 |
| WHO | 시민참여과, 정책기획관 |
| WHAT | 참여 기록 → 참여자수·응답률·만족도 → engagementIndex |
| HOW | 정규화 점수 합산 + 등급 분류 |

## Context Anchor
- WHY: 저참여 정책 식별 및 홍보 강화
- WHO: 정책 기획자
- RISK: 편향된 참여자 집단 감지
- SUCCESS: 지표 재현성 ≥ 95%
- SCOPE: `citizen-engagement-analyzer.ts`

## 요구사항
- FR-428.1: participationRate = participants / targetPopulation
- FR-428.2: responseScore = clip(participationRate × 100, 0, 100)
- FR-428.3: engagementIndex = responseScore × 0.5 + satisfaction × 0.5
- FR-428.4: grade LOW<40, MID<70, HIGH≥70
- FR-428.5: N2SF C/S 차단 + 감사 로그

## 추적성
FR-428.* ↔ `citizen-engagement-analyzer.ts` ↔ 테스트 ↔ CSAP D-06 N2SF N-05
