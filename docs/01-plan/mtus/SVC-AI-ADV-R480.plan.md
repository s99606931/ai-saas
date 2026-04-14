# SVC-AI-ADV-R480 Plan — AI기반 공공기관 민원 자동 분류 v3

## Context Anchor
| 항목 | 내용 |
|------|------|
| WHY | 민원 내용을 자동 분류하여 담당 부서 배정 자동화 및 처리 속도 향상 |
| WHO | 민원 담당 공무원, 민원 처리 시스템 |
| RISK | 잘못된 분류로 인한 민원 지연 방지 필요 |
| SUCCESS | SC-R480-1: 민원 등록 / SC-R480-2: 카테고리 분류 / SC-R480-3: 우선순위 결정 |
| SCOPE | public-complaint-classifier-v3.ts 구현 |

## 요구사항
- FR-R480.1: 민원 입력 (complaintId, content, submitterId, urgency: 'low'|'normal'|'high'|'emergency')
- FR-R480.2: 키워드 기반 분류 (도로/교통: TRAFFIC, 환경: ENVIRONMENT, 복지: WELFARE, 안전: SAFETY, 기타: OTHER)
- FR-R480.3: 우선순위 산출 (emergency: 1, high: 2, normal: 3, low: 4)
- FR-R480.4: submitterId PII 마스킹
- FR-R480.5: 감사 로그 전수 기록 (getAuditLog)

## 추적성
FR-R480.* ↔ `public-complaint-classifier-v3.ts` ↔ 테스트 ↔ CSAP D-06 N2SF
