# Design: MTU-N177 기술 부채 자동 측정 시스템

> 버전: 1.0 | 작성일: 2026-04-10

## 아키텍처

```
CI Pipeline ──→ Tech Debt Scanner ──→ Prometheus Metrics
                    │                      │
                    ├── 코드 복잡도         │
                    ├── 중복 감지           │
                    ├── TODO/FIXME 수집     │
                    ├── 의존성 노후도       │
                    └── 커버리지 갭         ▼
                                      Grafana Dashboard
```
