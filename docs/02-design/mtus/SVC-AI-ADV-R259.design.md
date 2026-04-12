# SVC-AI-ADV-R259 — AI 모델 버전 게이트웨이 Design

> 작성일: 2026-04-13 | 버전: 1.0.0

## 컴포넌트 설계

```
AIModelVersioningGateway
├── registerModel(model)
├── setTrafficSplit(modelId, bluePercent, greenPercent)
├── routeRequest(modelId, requestKey, caller, grade): RouteDecision
├── recordCall(modelId, version, success, latencyMs)
├── rollback(modelId)
├── getStats(modelId): ModelStats
└── getAuditLog(): AuditEntry[]
```

## 핵심 알고리즘

- **해시 기반 라우팅**: `hash(requestKey) % 100 < bluePercent` → blue, else green
  - 간단 FNV-1a 해시 사용
- **롤백**: green 상태 → RETIRED, blue는 100% 트래픽
- **통계**: 버전별 totalCalls, errorCalls, avgLatencyMs 계산

## CSAP 준수

- D-06: 등록·라우팅·롤백 감사 로그 (caller 마스킹)
- D-12: 트래픽 비율 합 == 100 검증
- N2SF: C/S 차단
