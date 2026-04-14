# SVC-AI-ADV-R515 Plan — AI기반 지능형 배포 승인 자동화

## Context Anchor
| 항목 | 내용 |
|------|------|
| WHY | 배포 요청을 자동 검토하여 위험도 낮은 배포는 자동 승인, 고위험은 수동 검토로 유도 |
| WHO | DevOps팀, 배포 관리자 |
| RISK | 미검증 배포로 인한 프로덕션 장애 방지 |
| SUCCESS | SC-R515-1: 배포 요청 검토 / SC-R515-2: 위험도 산출 / SC-R515-3: 승인 판정 |
| SCOPE | deployment-approval-automator-ai.ts 구현 |

## 요구사항
- FR-R515.1: 배포 요청 입력 (deployId, service, environment: 'dev'|'stg'|'prod', testsPassed, changedFiles, hasRollbackPlan)
- FR-R515.2: 위험 점수 계산 (prod:+40, stg:+10, dev:0) + (!testsPassed:+30) + (changedFiles>20:+20, >10:+10) + (!hasRollbackPlan:+15)
- FR-R515.3: 판정 (score<30: AUTO_APPROVE, score<60: MANUAL_REVIEW, else REJECT)
- FR-R515.4: 거부 사유 목록 반환
- FR-R515.5: 감사 로그 전수 기록 (getAuditLog)

## 추적성
FR-R515.* ↔ `deployment-approval-automator-ai.ts` ↔ 테스트 ↔ CSAP D-06 D-12
