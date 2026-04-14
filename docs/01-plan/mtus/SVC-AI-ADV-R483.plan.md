# SVC-AI-ADV-R483 Plan — AI기반 서비스 레지스트리 자동화 v2

## Context Anchor
| 항목 | 내용 |
|------|------|
| WHY | 마이크로서비스 레지스트리를 자동으로 관리하여 서비스 디스커버리 효율화 |
| WHO | DevOps 팀, 마이크로서비스 운영팀 |
| RISK | 레지스트리 불일치로 인한 서비스 라우팅 오류 방지 필요 |
| SUCCESS | SC-R483-1: 서비스 등록 / SC-R483-2: 상태 갱신 / SC-R483-3: 비정상 서비스 탐지 |
| SCOPE | service-registry-automator-v2.ts 구현 |

## 요구사항
- FR-R483.1: 서비스 등록 (serviceId, name, version, endpoint, healthCheckUrl)
- FR-R483.2: 헬스 상태 갱신 (serviceId, status: 'UP'|'DOWN'|'DEGRADED', responseMs)
- FR-R483.3: 비정상 서비스 탐지 (DOWN||responseMs>5000: UNHEALTHY, DEGRADED: DEGRADED, else HEALTHY)
- FR-R483.4: 레지스트리 목록 조회 (전체 서비스 현황)
- FR-R483.5: 감사 로그 전수 기록 (getAuditLog)

## 추적성
FR-R483.* ↔ `service-registry-automator-v2.ts` ↔ 테스트 ↔ CSAP D-06
