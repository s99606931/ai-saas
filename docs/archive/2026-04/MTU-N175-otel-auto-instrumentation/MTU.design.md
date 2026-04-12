# Design: MTU-N175 OpenTelemetry Auto-Instrumentation Operator

> 버전: 1.0 | 작성일: 2026-04-10

## 1. Design Anchor

- 핵심 결정: OTel Operator + 2티어 Collector + Auto-Instrumentation

## 2. 아키텍처

```
App Pods (자동 주입)
  │ OTel SDK (auto-injected)
  ▼
DaemonSet Agent (OTel Collector)
  │ 필터링, 샘플링, PII 마스킹
  ▼
Gateway Collector (Deployment)
  │
  ├──→ Tempo (Traces)
  ├──→ Loki (Logs)
  └──→ Prometheus (Metrics)
```

## 3. 상세 설계

### 3.1 OTel Operator

```yaml
apiVersion: opentelemetry.io/v1beta1
kind: OpenTelemetryCollector
metadata:
  name: otel-agent
spec:
  mode: daemonset
  config:
    receivers:
      otlp:
        protocols:
          grpc:
            endpoint: 0.0.0.0:4317
          http:
            endpoint: 0.0.0.0:4318
    processors:
      batch:
        timeout: 5s
        send_batch_size: 1024
      attributes/pii-mask:
        actions:
          - key: user.email
            action: hash
          - key: user.name
            action: hash
    exporters:
      otlp/gateway:
        endpoint: otel-gateway:4317
        tls:
          insecure: false
```

### 3.2~3.8: Auto-Instrumentation, Gateway, 연동 설정 등
