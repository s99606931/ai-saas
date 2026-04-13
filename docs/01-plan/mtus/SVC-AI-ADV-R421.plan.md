# SVC-AI-ADV-R421 Plan — AI-Powered Grant Reviewer

## Executive Summary
| 관점 | 내용 |
|------|------|
| WHY | 공공 보조금 신청서의 자격/금액/리스크를 자동 심사하여 담당자 업무량 감축 |
| WHO | 지자체 복지과, 중앙부처 보조금 집행 부서 |
| WHAT | 신청 데이터(소득/가족수/이력) → 자격 판정 + 권장 지급액 + 리스크 스코어 |
| HOW | 규칙 기반 결정 트리 + 이력 가중치 + N2SF 차단 |

## Context Anchor
- WHY: 수작업 심사 지연 해소 (평균 14일 → 3일)
- WHO: 공공 보조금 집행 담당자
- RISK: 부정 수급 미탐지 시 감사 지적
- SUCCESS: 자격 정확도 ≥ 95%, 리스크 재현율 ≥ 90%
- SCOPE: `grant-reviewer-ai.ts`

## 요구사항
- FR-421.1: 소득 ≤ incomeCap AND age ≥ minAge → eligible=true
- FR-421.2: recommendedAmount = baseAmount × (1 - income/incomeCap) (clip 0~base)
- FR-421.3: 부정수급 이력(fraudHistory) OR 중복신청 → riskLevel='HIGH'
- FR-421.4: N2SF C/S 등급 차단 (`N2SF_BLOCKED`)
- FR-421.5: 감사 로그(`getAuditLog()`) + 사유 코드 반환

## 추적성
FR-421.* ↔ `grant-reviewer-ai.ts` ↔ `grant-reviewer-ai.test.ts` ↔ CSAP D-06/D-12 N2SF N-05
