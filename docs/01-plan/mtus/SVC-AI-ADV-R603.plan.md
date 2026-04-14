# SVC-AI-ADV-R603 Plan — AI기반 공공기관 데이터 공유 자동화 v2

## Context Anchor
| 항목 | 내용 |
|------|------|
| WHY | 기관 간 데이터 공유 절차를 자동화하여 행정 효율 향상 |
| WHO | 데이터 공유 담당자, 개인정보 보호 담당 |
| RISK | N2SF C/S 등급 데이터 무단 공유 방지 |
| SUCCESS | SC-R603-1: 공유 요청 분류 / SC-R603-2: 승인 판단 / SC-R603-3: 공유 이력 기록 |
| SCOPE | public-data-sharing-automator-v2.ts 구현 |

## 요구사항
- FR-R603.1: 입력 (requestId, dataGrade: 'C'|'S'|'O', requesterId, receiverAgencyId, dataCategory, hasConsent: boolean)
- FR-R603.2: N2SF C/S 등급 → BLOCKED 에러
- FR-R603.3: O등급 자동 승인 = hasConsent === true
- FR-R603.4: 자동 승인 시 APPROVED, 미동의 시 PENDING_REVIEW, C/S는 BLOCKED
- FR-R603.5: 감사 로그 전수 기록 (getAuditLog) + requesterId 마스킹

## 추적성
FR-R603.* ↔ `public-data-sharing-automator-v2.ts` ↔ 테스트 ↔ CSAP D-06, N-05
