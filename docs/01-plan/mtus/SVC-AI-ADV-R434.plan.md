# SVC-AI-ADV-R434 Plan — Welfare Benefits Calculator v2

## Executive Summary
| 관점 | 내용 |
|------|------|
| WHY | 복지 급여 중복 수급 방지 + 최적 조합 자동 추천 |
| WHO | 보건복지부, 지자체 복지과 |
| WHAT | 대상자 프로필 + 신청 급여 목록 → 중복 여부 + 최적 조합 |
| HOW | 상호배타 규칙 + 총액 최대화 그리디 |

## Context Anchor
- WHY: 중복 수급 환수 방지, 사각지대 최소화
- WHO: 복지 상담사
- RISK: 오산출 → 수급자 손실
- SUCCESS: 중복 탐지 100%, 최적 조합 일치율 ≥ 98%
- SCOPE: `welfare-benefits-calculator-v2.ts`

## 요구사항
- FR-434.1: 급여 정의 = { id, amount, excludes: string[] }
- FR-434.2: 상호배타 급여 동시 신청 → conflicts 목록 반환
- FR-434.3: 최적 조합 = 배타 제약 하에서 총액 최대화 (2^N 완전 탐색, N ≤ 20)
- FR-434.4: totalAmount = 선택된 급여 amount 합
- FR-434.5: N2SF C/S 차단 + `getAuditLog()`

## 추적성
FR-434.* ↔ `welfare-benefits-calculator-v2.ts` ↔ 테스트 ↔ CSAP D-06 N2SF N-05
