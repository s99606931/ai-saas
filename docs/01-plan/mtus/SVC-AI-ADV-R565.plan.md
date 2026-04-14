# SVC-AI-ADV-R565 Plan — AI기반 공공기관 의사결정 자동화 v2

## Context Anchor
| 항목 | 내용 |
|------|------|
| WHY | 반복 의사결정 프로세스를 자동화하여 행정 처리 속도 향상 |
| WHO | 정책 결재 담당자, 자동화 팀 |
| RISK | 자동화 오류로 인한 잘못된 의사결정 방지 |
| SUCCESS | SC-R565-1: 안건 분류 / SC-R565-2: 자동 결재 판단 / SC-R565-3: 결재 이력 기록 |
| SCOPE | decision-automation-ai-v2.ts 구현 |

## 요구사항
- FR-R565.1: 입력 (requestId, category, amount, requesterGrade, urgency: 'HIGH'|'MEDIUM'|'LOW', hasAttachments: boolean)
- FR-R565.2: 자동 결재 가능 여부 (amount<=1000000 && requesterGrade>='3' && hasAttachments: true, else false)
- FR-R565.3: 결재 경로 (자동결재: AUTO / urgency='HIGH': FAST_TRACK / else STANDARD)
- FR-R565.4: 예상 처리일 (AUTO: 0, FAST_TRACK: 1, STANDARD: 3)
- FR-R565.5: 감사 로그 전수 기록 (getAuditLog)

## 추적성
FR-R565.* ↔ `decision-automation-ai-v2.ts` ↔ 테스트 ↔ CSAP D-06
