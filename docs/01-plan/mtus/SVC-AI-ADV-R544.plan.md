# SVC-AI-ADV-R544 Plan — API 스로틀링 최적화 AI

## Context Anchor
| 항목 | 내용 |
|------|------|
| WHY | 공공 API 남용 방지 및 공정한 자원 배분 보장 |
| WHO | API 게이트웨이 운영자, 서비스 품질 관리자 |
| RISK | 과도한 제한으로 인한 정상 서비스 저하 방지 |
| SUCCESS | SC-R544-1: 사용 패턴 수집 / SC-R544-2: 한도 최적화 / SC-R544-3: 정책 권고 |
| SCOPE | api-throttling-optimizer-ai.ts 구현 |

## 요구사항
- FR-R544.1: 입력 (clientId, requestsLast1h, currentLimit, avgResponseMs, errorRate)
- FR-R544.2: 사용률 = requestsLast1h / currentLimit * 100
- FR-R544.3: 권고 한도 (사용률>90&&errorRate<0.01: currentLimit*1.5, 사용률<30: currentLimit*0.7, 사용률>90&&errorRate>=0.01: currentLimit*0.8, else currentLimit) — 정수로 올림
- FR-R544.4: 상태 (사용률>90: HIGH_USAGE, <30: LOW_USAGE, else NORMAL)
- FR-R544.5: 감사 로그 전수 기록 (getAuditLog)

## 추적성
FR-R544.* ↔ `api-throttling-optimizer-ai.ts` ↔ 테스트 ↔ CSAP D-06
