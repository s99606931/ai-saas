# SVC-AI-ADV-R516 Plan — AI기반 API 게이트웨이 보안 강화 v2

## Context Anchor
| 항목 | 내용 |
|------|------|
| WHY | API 요청을 분석해 비정상 패턴을 탐지하고 자동 차단 정책 생성 |
| WHO | API 보안팀, 게이트웨이 운영자 |
| RISK | API 남용·공격으로 인한 서비스 마비 방지 |
| SUCCESS | SC-R516-1: 요청 분석 / SC-R516-2: 이상 탐지 / SC-R516-3: 차단 정책 생성 |
| SCOPE | api-gateway-security-enhancer-v2.ts 구현 |

## 요구사항
- FR-R516.1: 요청 분석 입력 (clientId, endpoint, requestsPerMin, errorRate, uniqueIPs)
- FR-R516.2: 이상 탐지 (requestsPerMin>1000: RATE_ABUSE, errorRate>0.3: ERROR_STORM, uniqueIPs>500: IP_SWEEP)
- FR-R516.3: 위험도 (RATE_ABUSE/IP_SWEEP: HIGH, ERROR_STORM: MEDIUM, 정상: LOW)
- FR-R516.4: 차단 정책 생성 (HIGH: BLOCK, MEDIUM: THROTTLE, LOW: ALLOW)
- FR-R516.5: 감사 로그 전수 기록 (getAuditLog)

## 추적성
FR-R516.* ↔ `api-gateway-security-enhancer-v2.ts` ↔ 테스트 ↔ CSAP D-06 D-08
