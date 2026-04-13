# SVC-AI-ADV-R435 Plan — Tax Audit Risk Assessor AI

## Executive Summary
| 관점 | 내용 |
|------|------|
| WHY | 탈세 가능성 납세자 선별 + 조사 우선순위 배정 |
| WHO | 국세청, 지방세정 |
| WHAT | 납세자 지표(매출, 신고, 현금비율) → 위험 점수 → 우선순위 |
| HOW | 가중합 기반 risk score + 구간 분류 |

## Context Anchor
- WHY: 조사 자원 효율적 배분
- WHO: 조사관, 조사계획 수립자
- RISK: 인권 침해 가능 → 설명가능성 필수
- SUCCESS: 고위험군 탐지율 ≥ 85%
- SCOPE: `tax-audit-risk-assessor-ai.ts`

## 요구사항
- FR-435.1: score = 0.4*cashRatio + 0.3*reportGap + 0.3*industryRisk (0..1)
- FR-435.2: score ≥ 0.7 → 'HIGH', 0.4~0.7 → 'MEDIUM', <0.4 → 'LOW'
- FR-435.3: factors: 기여도 상위 항목 반환 (설명가능성)
- FR-435.4: 결과 정렬: HIGH desc → MEDIUM → LOW
- FR-435.5: N2SF C/S 차단 + `getAuditLog()`

## 추적성
FR-435.* ↔ `tax-audit-risk-assessor-ai.ts` ↔ 테스트 ↔ CSAP D-06 N2SF N-05
