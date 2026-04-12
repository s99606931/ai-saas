# Design: MTU-N176 Cilium Hubble 네트워크 관측성

> 버전: 1.0 | 작성일: 2026-04-10

## 아키텍처

```
Cilium Agent (eBPF) ──→ Hubble Server (per-node)
                              │
                         Hubble Relay (클러스터 집계)
                              │
                    ┌─────────┼─────────┐
                    ▼         ▼         ▼
              Hubble UI   Prometheus   Grafana
            (서비스맵)    (메트릭)    (대시보드)
```
