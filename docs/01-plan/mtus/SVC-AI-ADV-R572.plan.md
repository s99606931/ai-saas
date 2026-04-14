# SVC-AI-ADV-R572 Plan — AI기반 멀티클라우드 네트워크 최적화 v2

## Context Anchor
| 항목 | 내용 |
|------|------|
| WHY | 멀티클라우드 환경에서 네트워크 비용 최소화 및 성능 최적화 |
| WHO | 클라우드 아키텍트, 네트워크 운영팀 |
| RISK | 잘못된 라우팅 변경으로 인한 서비스 장애 방지 |
| SUCCESS | SC-R572-1: 네트워크 수집 / SC-R572-2: 경로 최적화 / SC-R572-3: 권고 생성 |
| SCOPE | multicloud-network-optimizer-v2.ts 구현 |

## 요구사항
- FR-R572.1: 입력 (networkId, links: {from, to, latencyMs, costPerGB, bandwidthMbps}[])
- FR-R572.2: 각 링크 점수 = (1 - min(latencyMs/1000,1))*0.5 + (1 - min(costPerGB/10,1))*0.3 + min(bandwidthMbps/1000,1)*0.2
- FR-R572.3: 링크 상태 (점수>=0.7: OPTIMAL, >=0.4: ACCEPTABLE, else BOTTLENECK)
- FR-R572.4: 최적 링크 (점수 최고), 병목 링크 목록 (BOTTLENECK 상태)
- FR-R572.5: 감사 로그 전수 기록 (getAuditLog)

## 추적성
FR-R572.* ↔ `multicloud-network-optimizer-v2.ts` ↔ 테스트 ↔ CSAP D-06
