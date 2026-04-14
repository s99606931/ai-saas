# SVC-AI-ADV-R542 Plan — 서비스 메시 가시성 강화 AI

## Context Anchor
| 항목 | 내용 |
|------|------|
| WHY | 마이크로서비스 간 통신 지연/오류를 시각화하여 병목 선제 제거 |
| WHO | 서비스 아키텍트, SRE |
| RISK | 잘못된 메시 분석으로 인한 불필요한 재구성 방지 |
| SUCCESS | SC-R542-1: 메시 수집 / SC-R542-2: 경로 분석 / SC-R542-3: 최적화 권고 |
| SCOPE | service-mesh-visibility-enhancer-ai.ts 구현 |

## 요구사항
- FR-R542.1: 입력 (meshId, edges: {from, to, latencyMs, errorRate, requestsPerMin}[])
- FR-R542.2: 각 엣지 상태 (latencyMs>1000||errorRate>0.1: CRITICAL, latencyMs>500||errorRate>0.05: DEGRADED, else HEALTHY)
- FR-R542.3: 전체 메시 점수 = HEALTHY엣지수/전체엣지수*100
- FR-R542.4: 핫스팟 = CRITICAL 엣지의 (from, to) 목록
- FR-R542.5: 감사 로그 전수 기록 (getAuditLog)

## 추적성
FR-R542.* ↔ `service-mesh-visibility-enhancer-ai.ts` ↔ 테스트 ↔ CSAP D-06
