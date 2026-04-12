# Design: MTU-N180 16라운드 통합 테스트

> 버전: 1.0 | 작성일: 2026-04-10

## 통합 아키텍처

```
OTel Auto-Instrumentation (N175) ──→ Traces/Metrics/Logs
Hubble Network (N176) ──→ Network Flows
                                    │
                              Prometheus/Loki/Tempo
                                    │
                    ┌───────────────┼───────────────┐
                    ▼               ▼               ▼
            Tech Debt (N177)  SLO Escalation (N178) Audit (N179)
            점수 계산          에러 버짓 모니터링    해시 체인 무결성
```
