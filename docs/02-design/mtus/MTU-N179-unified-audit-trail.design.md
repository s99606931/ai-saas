# Design: MTU-N179 감사 추적 완전 통합

> 버전: 1.0 | 작성일: 2026-04-10

## 아키텍처

```
App Services ──→ Audit SDK ──→ ┐
K8s API Server ──→ Audit Webhook ──→ │
Keycloak ──→ Event Listener ──→ ├──→ Central Audit Collector
GitOps (Flux) ──→ Notification ──→ │        │
CI/CD Pipeline ──→ Webhook ──→ ┘        ▼
                                   Loki (장기 저장)
                                        │
                                   Grafana Dashboard
                                        │
                                   CSAP D-06 증적 생성
```
