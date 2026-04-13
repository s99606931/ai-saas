# SVC-AI-ADV-R432 Plan — Passport/Visa AI Processor

## Executive Summary
| 관점 | 내용 |
|------|------|
| WHY | 여권·비자 신청 완전성 검사 + 우선순위 배정 자동화 |
| WHO | 외교부, 재외공관 |
| WHAT | 신청서 → 서류 완전성 검사 → 긴급도 스코어 → 처리 순위 |
| HOW | 서류 체크리스트 + 여행 임박도(출국일-오늘) 기반 우선순위 |

## Context Anchor
- WHY: 여행 임박 신청자 적시 발급, 서류 부실 반려 자동화
- WHO: 여권/비자 심사관
- RISK: 우선순위 오류 → 출국 불가 발생
- SUCCESS: 완전성 검사 정확도 95%+, 긴급건 식별률 100%
- SCOPE: `passport-visa-processor-ai.ts`

## 요구사항
- FR-432.1: 필수 서류 목록(photo, idCopy, application, fee) 누락 → 'INCOMPLETE'
- FR-432.2: 출국일 7일 이내 → urgency='URGENT', 30일 이내 → 'HIGH', else 'NORMAL'
- FR-432.3: 완전성 점수 = 제출서류수 / 필수서류수
- FR-432.4: 우선순위 = URGENT > HIGH > NORMAL, 동순위 내 완전성 점수 순
- FR-432.5: N2SF C/S 차단 + `getAuditLog()`

## 추적성
FR-432.* ↔ `passport-visa-processor-ai.ts` ↔ 테스트 ↔ CSAP D-06 N2SF N-05
