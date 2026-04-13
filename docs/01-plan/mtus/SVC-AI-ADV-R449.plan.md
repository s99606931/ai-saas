# SVC-AI-ADV-R449 Plan — AI 기반 재정 감사 자동화

## Executive Summary
| 관점 | 내용 |
|------|------|
| WHY | 지출 증빙 자동 검토 + 부정 수급 탐지 |
| WHO | 감사원, 기관 재정 감사팀 |
| WHAT | 지출 건 → 위반 사유 + 위험도 |
| HOW | 규칙 엔진(한도 초과, 증빙 누락, 중복) |

## Context Anchor
- WHY: 재정 감사 효율화
- WHO: 감사 담당관
- RISK: 오탐 → 화이트리스트 제외
- SUCCESS: 규칙 3개 위반 탐지율 100%
- SCOPE: `public-finance-audit-ai.ts`

## 요구사항
- FR-449.1: Expense = { id, amount, category, evidence: string[], date }
- FR-449.2: 한도 테이블: travel=500000, meal=100000, office=200000
- FR-449.3: 위반 = amount > limit(category) OR evidence.length == 0
- FR-449.4: 같은 date/category/amount 2회+ = DUPLICATE
- FR-449.5: N2SF C/S 차단 + `getAuditLog()`

## 추적성
FR-449.* ↔ `public-finance-audit-ai.ts` ↔ 테스트 ↔ CSAP D-06 N2SF N-05
