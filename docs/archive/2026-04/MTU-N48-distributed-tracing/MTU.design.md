# MTU-N48: Grafana Tempo 분산 추적 고도화 — Design

> **버전**: 1.0.0 | **작성일**: 2026-04-09 | **Plan 참조**: MTU-N48.plan.md

---

## Design Anchor

| 항목 | 결정 |
|------|------|
| Tempo 모드 | 단일 바이너리 (k3s 환경 적합) |
| 수신 프로토콜 | OTLP gRPC(4317) + OTLP HTTP(4318) |
| 스토리지 | 로컬 PV (초기) → S3 호환 (확장 시) |
| 보존 기간 | 7일 (dev) / 30일 (stg) / 90일 (prod) |
| 상호 연결 | Trace→Metric (span metrics), Trace→Log (traceID 주입) |

---

## 아키텍처

```
[Application] → [OTel SDK] → [OTel Collector]
                                    ↓
                          ┌─────────┴─────────┐
                          ↓                   ↓
                    [Tempo]             [Prometheus]
                    (traces)            (span metrics)
                          ↓                   ↓
                    [Grafana] ← 상호 연결 → [Loki]
                    (TraceQL)              (logs)
```

---

## OTel Collector 파이프라인

```yaml
receivers:
  otlp: gRPC/HTTP

processors:
  batch: 배치 처리
  attributes: PII 필터링 (N2SF)
  spanmetrics: trace→metric 변환

exporters:
  otlp/tempo: Tempo 전송
  prometheus: span metrics → Prometheus
```

---

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0.0 | 2026-04-09 | 최초 작성 | PM Lead |
