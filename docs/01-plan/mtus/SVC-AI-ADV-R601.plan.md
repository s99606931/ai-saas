# SVC-AI-ADV-R601 Plan — AI기반 공공기관 지능형 알림 관리 v2

## Context Anchor
| 항목 | 내용 |
|------|------|
| WHY | 알림 우선순위를 자동 조정하여 중요 알림 누락 방지 및 알림 피로 감소 |
| WHO | 서비스 운영팀, 공무원 |
| RISK | 중요 알림 차단 방지 |
| SUCCESS | SC-R601-1: 알림 분류 / SC-R601-2: 우선순위 산정 / SC-R601-3: 전달 채널 결정 |
| SCOPE | intelligent-notification-manager-v2.ts 구현 |

## 요구사항
- FR-R601.1: 입력 (notificationId, category, severity: 'CRITICAL'|'HIGH'|'MEDIUM'|'LOW', recipientCount, isDuplicate: boolean)
- FR-R601.2: 우선순위 점수 = (CRITICAL→100/HIGH→70/MEDIUM→40/LOW→10) + min(recipientCount/100,1)*20 - (isDuplicate?30:0)
- FR-R601.3: 전달 채널 (점수>=80: SMS+EMAIL, >=50: EMAIL, >=20: APP, else SUPPRESS)
- FR-R601.4: 억제 여부 (채널=SUPPRESS: true, else false)
- FR-R601.5: 감사 로그 전수 기록 (getAuditLog)

## 추적성
FR-R601.* ↔ `intelligent-notification-manager-v2.ts` ↔ 테스트 ↔ CSAP D-06
