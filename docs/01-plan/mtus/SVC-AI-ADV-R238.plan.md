# SVC-AI-ADV-R238 Plan: AI기반 공공 조달 자동화

## Context Anchor
| 항목 | 내용 |
|------|------|
| WHY | 공공 조달 위험 자동 분석으로 부패 방지 및 투명성 확보 |
| WHO | 조달 담당자, 감사 부서 |
| RISK | 고위험 조달 승인 누락 시 감사 지적 |
| SUCCESS | 위험 점수 기반 자동 심의 요청 |
| SCOPE | ai-service 내 PublicProcurementAutomationAi 클래스 |

## 요구사항
- FR-R238.1: 수의계약/긴급/단독입찰 위험 점수 산출
- FR-R238.2: 1억 이상 또는 HIGH/VERY_HIGH → 위원회 심의
- FR-R238.3: VERY_HIGH → REVIEW 상태 자동 전환
- FR-R238.4: CSAP D-06 감사 로그
