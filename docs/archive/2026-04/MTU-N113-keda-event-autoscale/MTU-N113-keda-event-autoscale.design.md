# MTU-N113: KEDA 이벤트 기반 오토스케일 완성 — 설계 문서

> 버전: 1.0.0 | 작성일: 2026-04-10 | 작성자: PM Lead
> Plan 참조: docs/01-plan/mtus/MTU-N113-keda-event-autoscale.plan.md

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0.0 | 2026-04-10 | 최초 작성 | PM Lead |

## Design Anchor

| 항목 | 내용 |
|------|------|
| 아키텍처 패턴 | Pragmatic Balance — 기존 KEDA + HTTP Add-on + Prometheus 스케일러 조합 |
| 핵심 결정 | HTTP Add-on으로 HTTP RPS 기반 스케일링, Prometheus로 비즈니스 메트릭 스케일링 |
| 제약 | k3s 단일 클러스터 환경, 외부 메시지 큐 미사용 (Kafka/Redis 없음), ESO 연동 |
| 의존성 | KEDA (기 설치), Prometheus (기 설치), ESO (기 설치), Grafana (기 설치) |

## 아키텍처 옵션 분석

### Option A: KEDA HTTP Add-on 전용
- 장점: 단순한 구성, HTTP 워크로드 최적화
- 단점: 비 HTTP 메트릭 스케일링 불가

### Option B: Prometheus 스케일러 전용
- 장점: 유연한 PromQL 쿼리 기반 스케일링
- 단점: Prometheus 의존, 메트릭 지연 가능

### Option C: Pragmatic Balance (선택)
- HTTP Add-on + Prometheus + Cron 스케일러 조합
- 워크로드 유형별 최적 스케일러 매핑
- 장점: 전체 스케일링 시나리오 커버, 유연성 극대화
- 단점: 구성 복잡도 증가 (문서화로 해결)

## 상세 설계

### DS-N113.1: KEDA HTTP Add-on 설치

```yaml
# infra/keda/http-add-on/values.yaml
httpAddon:
  enabled: true
  interceptor:
    replicas: 2
    resources:
      requests:
        cpu: 100m
        memory: 128Mi
      limits:
        cpu: 500m
        memory: 256Mi
  scaler:
    replicas: 1
  operator:
    replicas: 1
```

```yaml
# infra/keda/http-add-on/httpscaledobject-api-gateway.yaml
apiVersion: http.keda.sh/v1alpha1
kind: HTTPScaledObject
metadata:
  name: api-gateway-http
  namespace: saas-system
spec:
  hosts:
    - "api.saas.local"
  targetPendingRequests: 100
  scaleTargetRef:
    name: api-gateway
    kind: Deployment
    apiVersion: apps/v1
  replicas:
    min: 1
    max: 10
  scalingMetric:
    requestRate:
      targetValue: 50
      granularity: 1s
      window: 1m
  scaledownPeriod: 300
```

### DS-N113.2: Prometheus 메트릭 기반 ScaledObject

```yaml
# infra/keda/scaled-objects/prometheus-error-rate.yaml
apiVersion: keda.sh/v1alpha1
kind: ScaledObject
metadata:
  name: auth-service-error-rate
  namespace: saas-system
spec:
  scaleTargetRef:
    name: auth-service
  pollingInterval: 15
  cooldownPeriod: 300
  minReplicaCount: 2
  maxReplicaCount: 10
  advanced:
    restoreToOriginalReplicaCount: true
    horizontalPodAutoscalerConfig:
      behavior:
        scaleDown:
          stabilizationWindowSeconds: 300
          policies:
            - type: Percent
              value: 25
              periodSeconds: 60
        scaleUp:
          stabilizationWindowSeconds: 30
          policies:
            - type: Percent
              value: 100
              periodSeconds: 30
  triggers:
    - type: prometheus
      metadata:
        serverAddress: http://prometheus-operated.monitoring:9090
        query: |
          sum(rate(http_requests_total{service="auth-service",code=~"5.."}[5m]))
          /
          sum(rate(http_requests_total{service="auth-service"}[5m])) * 100
        threshold: "5"
        activationThreshold: "2"
      authenticationRef:
        name: prometheus-trigger-auth
```

### DS-N113.3: Cron 기반 스케줄 스케일링

```yaml
# infra/keda/scaled-objects/cron-business-hours.yaml
apiVersion: keda.sh/v1alpha1
kind: ScaledObject
metadata:
  name: api-gateway-cron
  namespace: saas-system
spec:
  scaleTargetRef:
    name: api-gateway
  triggers:
    - type: cron
      metadata:
        timezone: Asia/Seoul
        start: 0 8 * * 1-5
        end: 0 19 * * 1-5
        desiredReplicas: "5"
    - type: cron
      metadata:
        timezone: Asia/Seoul
        start: 0 19 * * 1-5
        end: 0 8 * * 2-6
        desiredReplicas: "2"
    - type: cron
      metadata:
        timezone: Asia/Seoul
        start: 0 0 * * 0,6
        end: 0 0 * * 1
        desiredReplicas: "1"
```

### DS-N113.4: TriggerAuthentication

```yaml
# infra/keda/trigger-auth/prometheus-auth.yaml
apiVersion: keda.sh/v1alpha1
kind: TriggerAuthentication
metadata:
  name: prometheus-trigger-auth
  namespace: saas-system
spec:
  secretTargetRef:
    - parameter: bearerToken
      name: prometheus-keda-token
      key: token
    - parameter: ca
      name: prometheus-keda-token
      key: ca.crt
```

### DS-N113.5: 스케일링 정책 가이드

| 서비스 | 스케일러 | min | max | 쿨다운 | 안정화 |
|--------|---------|-----|-----|--------|--------|
| api-gateway | HTTP + Cron | 1 | 10 | 300s | 300s |
| auth-service | Prometheus (에러율) | 2 | 10 | 300s | 300s |
| tenant-service | CPU + Prometheus | 1 | 5 | 300s | 300s |
| catalog-service | CPU | 1 | 5 | 300s | 300s |
| audit-service | CPU | 1 | 3 | 600s | 600s |
| ai-gateway | HTTP + CPU | 1 | 8 | 120s | 120s |

### DS-N113.6: 제로 스케일 정책

```yaml
# infra/keda/idle-replicas/idle-policy.yaml
# 비핵심 서비스만 제로 스케일 허용
# 핵심 서비스(auth, api-gateway)는 minReplicaCount >= 1 유지
apiVersion: keda.sh/v1alpha1
kind: ScaledObject
metadata:
  name: catalog-service-idle
  namespace: saas-system
  annotations:
    keda.sh/idle-replicas: "0"
spec:
  scaleTargetRef:
    name: catalog-service
  idleReplicaCount: 0
  minReplicaCount: 1
  maxReplicaCount: 5
  cooldownPeriod: 600
  triggers:
    - type: prometheus
      metadata:
        serverAddress: http://prometheus-operated.monitoring:9090
        query: sum(rate(http_requests_total{service="catalog-service"}[5m]))
        threshold: "1"
        activationThreshold: "0.5"
```

### DS-N113.7: Grafana 대시보드 패널

KEDA 메트릭 대시보드 필수 패널:
- KEDA ScaledObject 상태 (Active/Idle/Error)
- 서비스별 현재 레플리카 vs 목표 레플리카
- HTTP Add-on 요청 큐 깊이
- Prometheus 트리거 메트릭 현재값
- 스케일 이벤트 히스토리 (타임라인)
- 스케일링 지연 시간 (트리거 → 실제 스케일)

### DS-N113.8: E2E 테스트 시나리오

| 테스트 | 시나리오 | 기대 결과 |
|--------|---------|----------|
| T-N113.1 | HTTP Add-on ScaledObject 적용 확인 | Ready 상태 |
| T-N113.2 | Prometheus ScaledObject YAML 유효성 | kubectl apply --dry-run 성공 |
| T-N113.3 | Cron ScaledObject YAML 유효성 | kubectl apply --dry-run 성공 |
| T-N113.4 | TriggerAuthentication 시크릿 참조 확인 | 하드코딩 없음 |
| T-N113.5 | 안정화 윈도우 설정 확인 | >= 300s |
| T-N113.6 | 핵심 서비스 minReplica >= 1 | auth, api-gateway 제로 스케일 아님 |
| T-N113.7 | 대시보드 JSON 유효성 | jq 파싱 성공 |
| T-N113.8 | 전체 매니페스트 네임스페이스 일관성 | saas-system |

## Session Guide

1. Plan 문서 확인 → Design 검토
2. HTTP Add-on 매니페스트 작성
3. Prometheus ScaledObject 작성
4. Cron ScaledObject 작성
5. TriggerAuthentication 작성
6. 스케일링 정책 문서화
7. Grafana 대시보드 JSON 작성
8. E2E 테스트 스크립트 작성
9. 검증 및 보고서 작성
