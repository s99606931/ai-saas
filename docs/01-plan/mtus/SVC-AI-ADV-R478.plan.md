# SVC-AI-ADV-R478 Plan — AI기반 자동 API 성능 최적화 v3

## Context Anchor
| 항목 | 내용 |
|------|------|
| WHY | API 응답 시간 및 처리량 분석을 통해 성능 병목을 자동 탐지하고 최적화 권고 |
| WHO | 백엔드 개발팀, API 운영팀 |
| RISK | 성능 저하로 인한 서비스 SLO 미달 방지 필요 |
| SUCCESS | SC-R478-1: API 메트릭 수집 / SC-R478-2: 병목 탐지 / SC-R478-3: 최적화 권고 |
| SCOPE | api-performance-optimizer-v3.ts 구현 |

## 요구사항
- FR-R478.1: API 메트릭 입력 (apiId, avgResponseMs, p99ResponseMs, errorRate, callsPerMin)
- FR-R478.2: 상태 분류 (p99>2000||errorRate>0.05: CRITICAL, p99>1000||errorRate>0.01: WARNING, else HEALTHY)
- FR-R478.3: 최적화 권고 (CRITICAL: CACHE+RATE_LIMIT, WARNING: CACHE, HEALTHY: NONE)
- FR-R478.4: 성능 점수 = 100 - min(p99/20, 50) - min(errorRate*1000, 50)
- FR-R478.5: 감사 로그 전수 기록 (getAuditLog)

## 추적성
FR-R478.* ↔ `api-performance-optimizer-v3.ts` ↔ 테스트 ↔ CSAP D-06
