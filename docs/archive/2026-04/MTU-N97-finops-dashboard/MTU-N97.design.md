# MTU-N97: 테넌트별 FinOps 대시보드 — Design

> **버전**: 1.0.0 | **작성일**: 2026-04-10 | **작성자**: PM Lead

---

## 1. 비용 모델

| 리소스 | 단가 (시간당) | 설명 |
|--------|-------------|------|
| CPU (1 vCPU) | 0.05 USD | 클라우드 환산 기준 |
| Memory (1 GiB) | 0.01 USD | 클라우드 환산 기준 |
| Storage (1 GiB) | 0.0001 USD | local-path 기준 |
| Network (1 GiB) | 0.01 USD | 내부 트래픽 |

---

## 2. 상세 설계

### 2.1 비용 할당 Recording Rules (FR-N97.1)

```yaml
- record: tenant:cost_cpu:hourly_usd
  expr: |
    sum by (namespace) (
      rate(container_cpu_usage_seconds_total{container!=""}[1h])
    ) * 0.05

- record: tenant:cost_memory:hourly_usd
  expr: |
    sum by (namespace) (
      container_memory_working_set_bytes{container!=""}
    ) / 1073741824 * 0.01

- record: tenant:cost_total:hourly_usd
  expr: |
    tenant:cost_cpu:hourly_usd + tenant:cost_memory:hourly_usd
```

### 2.2 리소스 효율성 점수 (FR-N97.3)

```yaml
- record: tenant:resource_efficiency:ratio
  expr: |
    (sum by (namespace) (rate(container_cpu_usage_seconds_total[5m]))
     / sum by (namespace) (kube_pod_container_resource_requests{resource="cpu"}))
    * 100
```

---

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0.0 | 2026-04-10 | 최초 작성 | PM Lead |
