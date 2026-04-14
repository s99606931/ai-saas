# SVC-AI-ADV-R602 Plan — AI기반 자동 서비스 메시 정책 최적화 v2

## Context Anchor
| 항목 | 내용 |
|------|------|
| WHY | 서비스 메시 정책을 자동 최적화하여 트래픽 품질 및 보안 강화 |
| WHO | 서비스 아키텍트, 플랫폼 팀 |
| RISK | 잘못된 정책 적용으로 인한 서비스 단절 방지 |
| SUCCESS | SC-R602-1: 정책 분석 / SC-R602-2: 최적화 제안 / SC-R602-3: 위험 평가 |
| SCOPE | service-mesh-policy-optimizer-v2.ts 구현 |

## 요구사항
- FR-R602.1: 입력 (meshId, policies: {policyId, type: 'RETRY'|'TIMEOUT'|'CIRCUIT_BREAKER'|'RATE_LIMIT', currentValue, recommendedValue, impactScore: 0~10}[])
- FR-R602.2: 각 정책 변경 필요 여부 = currentValue !== recommendedValue
- FR-R602.3: 정책 위험도 (impactScore>=8: HIGH, >=5: MEDIUM, else LOW)
- FR-R602.4: 전체 최적화 점수 = 변경불필요정책수/전체정책수*100
- FR-R602.5: 감사 로그 전수 기록 (getAuditLog)

## 추적성
FR-R602.* ↔ `service-mesh-policy-optimizer-v2.ts` ↔ 테스트 ↔ CSAP D-06
