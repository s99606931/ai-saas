# MTU-N56: KEDA + VPA 오토스케일링 설계 문서

> **버전**: 1.0.0 | **작성일**: 2026-04-10 | **작성자**: infra-architect

---

## 3.1 아키텍처 개요

```
                    ┌───────────��─────────┐
                    │  KEDA Operator       │
                    │  (이벤트 기반 스케일) │
                    └──────┬──────────────┘
                           │ ScaledObject
                    ┌──────▼──────────────┐
                    │  HPA (수평 확장)     │ ← KEDA가 HPA 자동 생성
                    │  CPU/Mem + 커스텀    │
                    └──────┬──────���───────┘
                           │
                    ┌──────▼─────────────��┐
                    │  VPA (수직 확장)     │ ← 리소스 추천만 (Off/Initial)
                    │  Recommender only   │    HPA와 충돌 방지
                    └──────┬──────────────┘
                           ���
                    ┌─────���▼───────────��──┐
                    │  Pod Replicas        │
                    │  auth: 1~5          │
                    │  api-gw: 2~10       │
                    │  ai-gw: 0~3 (0 가능)│
                    └─────────────────────┘
```

### HPA + VPA 충돌 방지 전략

| 서비스 | HPA (수평) | VPA (수직) | 전략 |
|--------|----------|----------|------|
| auth-service | KEDA (CPU/RPS) | Off (추천만) | HPA 우선, VPA 추천 참고 |
| api-gateway | KEDA (RPS) | Off (추천만) | HPA 우선 |
| tenant-service | KEDA (CPU) | Initial (초기값만) | 최초 배포 시 VPA, 이후 HPA |
| audit-service | KEDA (큐 깊이) | Off | 이벤트 기반 전용 |
| ai-gateway | KEDA (큐 깊이) | Off | scale-to-zero 활성화 |
| catalog-service | KEDA (CPU) | Initial | 혼합 전략 |

---

## 3.2 ScaledObject 설계

### auth-service (RPS 기반)
```yaml
triggers:
  - type: prometheus
    metadata:
      serverAddress: http://kube-prometheus-stack-prometheus.monitoring:9090
      metricName: http_requests_per_second
      query: sum(rate(http_requests_total{service="auth-service"}[1m]))
      threshold: "100"              # RPS 100 초과 시 스케일
```

### ai-gateway (scale-to-zero)
```yaml
triggers:
  - type: prometheus
    metadata:
      query: sum(rate(http_requests_total{service="ai-gateway"}[5m]))
      threshold: "1"                # 1 RPS 미만 시 0으로 축소
minReplicaCount: 0                  # scale-to-zero 활성화
maxReplicaCount: 3
cooldownPeriod: 300                 # 5분 대기 후 축소
```

---

## 3.3 VPA 설정

```yaml
apiVersion: autoscaling.k8s.io/v1
kind: VerticalPodAutoscaler
spec:
  updatePolicy:
    updateMode: "Off"               # 추천만, 자동 적용 안함 (HPA 충돌 방지)
  resourcePolicy:
    containerPolicies:
      - containerName: "*"
        minAllowed:
          cpu: 10m
          memory: 32Mi
        maxAllowed:
          cpu: 1000m
          memory: 1Gi
```

---

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0.0 | 2026-04-10 | 최초 작성 | infra-architect |
