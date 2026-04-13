# SVC-AI-ADV-R455 Plan — AI 기반 인허가 자동 처리

## Executive Summary
| 관점 | 내용 |
|------|------|
| WHY | 건축/영업/환경 허가 신청 자동 사전 심사 |
| WHO | 시/군/구 허가과 |
| WHAT | 신청 정보 → 심사 결과 + 보완 항목 |
| HOW | 허가 유형별 체크리스트 + 필수 문서 검증 |

## Context Anchor
- WHY: 민원 처리 속도 향상
- WHO: 허가 심사관
- RISK: 자동 승인 오류 → 수동 검토 필수 플래그
- SUCCESS: 필수 문서 누락 100% 탐지
- SCOPE: `ai-permit-processor.ts`

## 요구사항
- FR-455.1: PermitType = 'building' | 'business' | 'environment'
- FR-455.2: Application = { id, type, applicant, documents: string[] }
- FR-455.3: 필수 문서 — building=[blueprint, landowner_consent, impact_assessment], business=[id_card, lease, insurance], environment=[eia_report, mitigation_plan]
- FR-455.4: 누락 문서 있으면 NEED_DOCS + missing 배열 반환
- FR-455.5: 모두 충족 → APPROVED, 단 environment는 REVIEW (수동 검토 플래그)
- FR-455.6: N2SF C/S 차단 + `getAuditLog()`

## 추적성
FR-455.* ↔ `ai-permit-processor.ts` ↔ 테스트 ↔ CSAP D-06 N2SF N-05
