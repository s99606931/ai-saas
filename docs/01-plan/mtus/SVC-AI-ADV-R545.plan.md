# SVC-AI-ADV-R545 Plan — 멀티테넌트 서비스 격리 v3

## Context Anchor
| 항목 | 내용 |
|------|------|
| WHY | 공공 SaaS 멀티테넌트 환경에서 기관 간 데이터 격리 보장 |
| WHO | 플랫폼 보안 담당자, 테넌트 관리자 |
| RISK | 테넌트 간 데이터 누출로 인한 CSAP 위반 방지 |
| SUCCESS | SC-R545-1: 격리 검증 / SC-R545-2: 위반 탐지 / SC-R545-3: 차단 기록 |
| SCOPE | multitenant-service-isolator-v3.ts 구현 |

## 요구사항
- FR-R545.1: 입력 (requestTenantId, resourceTenantId, resourceType, action, requesterId)
- FR-R545.2: 격리 위반 = requestTenantId !== resourceTenantId
- FR-R545.3: 위험도 (격리위반&&action='DELETE': CRITICAL, 격리위반&&action='WRITE': HIGH, 격리위반: MEDIUM, else SAFE)
- FR-R545.4: 결과 (SAFE: ALLOW, MEDIUM이상: DENY) + requesterIdMasked (앞2자 + *** + 뒤2자, 4자 미만이면 ***)
- FR-R545.5: 감사 로그 전수 기록 (getAuditLog)

## 추적성
FR-R545.* ↔ `multitenant-service-isolator-v3.ts` ↔ 테스트 ↔ CSAP D-06, D-08
