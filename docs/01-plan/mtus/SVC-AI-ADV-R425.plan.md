# SVC-AI-ADV-R425 Plan — AI-Based Tax Compliance Checker

## Executive Summary
| 관점 | 내용 |
|------|------|
| WHY | 세금 신고서의 규정 준수와 계산 오류 자동 탐지 |
| WHO | 국세청, 지방세청 |
| WHAT | 신고 데이터 → 오류 목록 + 심각도 + 권고 |
| HOW | 규칙 체크리스트(누락/한도/합계) + 심각도 분류 |

## Context Anchor
- WHY: 신고 반려율 감소
- WHO: 납세자, 세무 담당자
- RISK: 오탐으로 민원 발생
- SUCCESS: 오류 탐지 재현율 ≥ 92%
- SCOPE: `tax-compliance-checker-ai.ts`

## 요구사항
- FR-425.1: 필수 필드(income, taxpayerId) 누락 → 'CRITICAL'
- FR-425.2: deduction > income × 0.5 → 'HIGH' (과다공제)
- FR-425.3: |declared - calculated| > 100원 → 'MEDIUM'
- FR-425.4: compliant = CRITICAL/HIGH 이슈 없을 때 true
- FR-425.5: N2SF C/S 차단 + 감사 로그

## 추적성
FR-425.* ↔ `tax-compliance-checker-ai.ts` ↔ 테스트 ↔ CSAP D-06/D-12 N2SF N-05
