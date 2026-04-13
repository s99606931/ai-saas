# SVC-AI-ADV-R469 Plan — 사회 서비스 자격 자동 심사

## Executive Summary
| 관점 | 내용 |
|------|------|
| WHY | 복수 사회 서비스 자격을 통합 심사하여 신청 절차 단축 |
| WHO | 보건복지부, 시군구 복지과 |
| WHAT | 신청자 정보 → 자격 가능 서비스 목록 |
| HOW | 소득·가구원 수·연령 기준 매칭 |

## Context Anchor
- WHY: 서비스별 개별 심사의 중복 해소
- WHO: 복지 상담원
- RISK: 오판정 → 규칙 투명성 유지
- SUCCESS: 자격 판정 정확도 ≥ 95%
- SCOPE: `social-service-eligibility-ai.ts`

## 요구사항
- FR-469.1: `Applicant = { id, age, householdSize, monthlyIncome }`
- FR-469.2: `evaluate(applicant)` → `{ eligibleServices: string[], reasons: Record<string,string> }`
- FR-469.3: 서비스 정의 — 기초생활(소득 ≤ 100만×가구), 노인돌봄(age ≥ 65), 아동수당(age < 8), 한부모(household ≤ 2, income ≤ 300만)
- FR-469.4: 각 서비스 통과 시 eligibleServices 추가, 불통과 시 reasons에 사유 기록
- FR-469.5: N2SF C/S 차단 + `getAuditLog()`

## 추적성
FR-469.* ↔ `social-service-eligibility-ai.ts` ↔ 테스트 ↔ CSAP D-06 N2SF N-05
