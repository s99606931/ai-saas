# SVC-AI-ADV-R473 Plan — AI기반 개인정보 컴플라이언스 자동화 v2

## Context Anchor
| 항목 | 내용 |
|------|------|
| WHY | 개인정보보호법 준수 여부를 자동 검증하여 컴플라이언스 리스크 감소 |
| WHO | 개인정보 보호담당자, 법무팀 |
| RISK | 개인정보 처리 항목 누락 탐지 필요 |
| SUCCESS | SC-R473-1: 처리 항목 등록 / SC-R473-2: 준수율 계산 / SC-R473-3: C/S 등급 차단 |
| SCOPE | privacy-compliance-automator-v2.ts 구현 |

## 요구사항
- FR-R473.1: 개인정보 처리 항목 등록 (itemId, dataType, purpose, retentionDays, consentRequired)
- FR-R473.2: 동의 여부 기록 (itemId, consentGiven: boolean)
- FR-R473.3: 준수율 = 동의 필요한 항목 중 동의 완료 비율
- FR-R473.4: 미동의 필수 항목 조회
- FR-R473.5: N2SF N-05 C/S 등급 차단

## 추적성
FR-R473.* ↔ `privacy-compliance-automator-v2.ts` ↔ 테스트 ↔ CSAP D-06 N2SF N-05
