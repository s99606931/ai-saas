# SVC-AI-ADV-R604 Plan — AI기반 실시간 자원 부하 분산 최적화

## Context Anchor
| 항목 | 내용 |
|------|------|
| WHY | 자원 부하를 실시간 분산하여 특정 노드 과부하 방지 |
| WHO | 인프라 운영팀, SRE |
| RISK | 잘못된 분산으로 인한 레이턴시 증가 방지 |
| SUCCESS | SC-R604-1: 부하 수집 / SC-R604-2: 부하 불균형 탐지 / SC-R604-3: 분산 권고 |
| SCOPE | realtime-load-distribution-optimizer.ts 구현 |

## 요구사항
- FR-R604.1: 입력 (clusterId, nodes: {nodeId, cpuUsage, memUsage, requestCount}[])
- FR-R604.2: 각 노드 부하 점수 = cpuUsage*0.5 + memUsage*0.3 + min(requestCount/1000,1)*100*0.2
- FR-R604.3: 노드 상태 (점수>=80: OVERLOADED, >=60: HEAVY, else NORMAL)
- FR-R604.4: 평균 부하 = 모든 노드 부하 점수 평균, 불균형 여부 = max-min > 30
- FR-R604.5: 감사 로그 전수 기록 (getAuditLog)

## 추적성
FR-R604.* ↔ `realtime-load-distribution-optimizer.ts` ↔ 테스트 ↔ CSAP D-06
