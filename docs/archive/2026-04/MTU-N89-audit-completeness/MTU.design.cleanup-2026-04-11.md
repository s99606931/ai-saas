# MTU-N89: VictoriaMetrics 고성능 메트릭 저장소 — Design

> **Phase**: 모니터링 Round 7 — 심화 최적화
> **버전**: 1.0.0 | **작성일**: 2026-04-10 | **작성자**: PM Lead

---

## Design Anchor

| 항목 | 내용 |
|------|------|
| Plan 참조 | `docs/01-plan/mtus/MTU-N89-victoriametrics-storage.plan.md` |
| 아키텍처 옵션 | Option A: VictoriaMetrics Single (선택), Option B: VictoriaMetrics Cluster, Option C: Thanos |
| 선택 사유 | WSL2 단일 노드 환경에서 Single이 최적. 클러스터 대비 리소스 50% 절감, 운영 복잡도 최소 |

---

## Session Guide

```
1. Plan 문서 확인 (FR-N89.1~N89.7)
2. VictoriaMetrics Helm values 작성 (§2.1)
3. Prometheus remote_write 패치 (§2.2)
4. 데이터 보존 정책 설정 (§2.3)
5. Grafana 데이터소스 구성 (§2.4)
6. NetworkPolicy 작성 (§2.5)
7. 리소스 제한 설정 (§2.6)
8. 셋업 스크립트 통합 (§2.7)
9. 검증 스크립트 작성 및 실행
```

---

## 1. 아키텍처 개요

```
┌─────────────┐     remote_write      ┌──────────────────┐
│  Prometheus  │ ──────────────────────▶│  VictoriaMetrics  │
│  (30일 보존) │                        │  Single (365일)   │
└──────┬──────┘                        └────────┬─────────┘
       │                                        │
       │ scrape                                 │ /api/v1/query
       ▼                                        ▼
┌─────────────┐                        ┌──────────────────┐
│  Targets     │                        │   Grafana        │
│  (Services)  │                        │  (dual source)   │
└─────────────┘                        └──────────────────┘
```

**데이터 흐름**:
1. Prometheus가 서비스 타겟을 스크랩 (기존 동작 유지)
2. Prometheus가 remote_write로 VictoriaMetrics에 메트릭 전송
3. Grafana는 최근 30일 → Prometheus, 장기 → VictoriaMetrics 쿼리

---

## 2. 상세 설계

### 2.1 VictoriaMetrics Single Helm 차트 (FR-N89.1)

```yaml
# infra/monitoring/victoriametrics/values.yaml
# Helm 차트: victoria-metrics-single (vm/victoria-metrics-single)
# 배포 명령: helm install victoria-metrics vm/victoria-metrics-single \
#            -n monitoring -f infra/monitoring/victoriametrics/values.yaml

server:
  image:
    tag: "v1.106.1"
  
  # 데이터 저장 경로
  persistentVolume:
    enabled: true
    size: 50Gi
    storageClass: local-path   # k3s 기본 StorageClass

  # WSL2 리소스 최적화
  resources:
    requests:
      cpu: 200m
      memory: 512Mi
    limits:
      cpu: 500m
      memory: 1Gi

  # 보존 정책 (§2.3 참조)
  retentionPeriod: 12           # 12개월 = 365일

  # 성능 튜닝
  extraArgs:
    dedup.minScrapeInterval: 15s    # 중복 제거 간격
    search.maxUniqueTimeseries: 300000
    search.maxSamplesPerSeries: 30000000
    search.maxSamplesPerQuery: 1000000000
    maxLabelsPerTimeseries: 40
    search.cacheTimestampOffset: 5m  # 쿼리 캐시 유효 시간
```

### 2.2 Prometheus remote_write 연동 (FR-N89.2)

```yaml
# kube-prometheus-stack/values.yaml 에 추가할 remote_write 설정
prometheus:
  prometheusSpec:
    remoteWrite:
      - url: "http://victoria-metrics-server.monitoring.svc:8428/api/v1/write"
        queueConfig:
          maxSamplesPerSend: 10000
          capacity: 20000
          maxShards: 10
          minShards: 1
          batchSendDeadline: 5s
        writeRelabelConfigs:
          # __name__이 빈 메트릭 제외
          - sourceLabels: [__name__]
            regex: ""
            action: drop
```

### 2.3 데이터 보존 정책 (FR-N89.3)

| 계층 | 보존 기간 | 저장소 | 목적 |
|------|----------|--------|------|
| Prometheus (Hot) | 30일 | 15GB SSD | 실시간 알림 + 최근 대시보드 |
| VictoriaMetrics (Warm) | 365일 | 50GB HDD/SSD | CSAP D-06 감사 + 트렌드 분석 |

### 2.4 Grafana 데이터소스 (FR-N89.4)

```yaml
# infra/monitoring/victoriametrics/grafana-datasource.yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: grafana-victoriametrics-datasource
  namespace: monitoring
  labels:
    grafana_datasource: "true"
data:
  victoriametrics.yaml: |
    apiVersion: 1
    datasources:
      - name: VictoriaMetrics
        type: prometheus
        access: proxy
        url: http://victoria-metrics-server.monitoring.svc:8428
        isDefault: false
        jsonData:
          timeInterval: "15s"
          httpMethod: POST
          customQueryParameters: "nocache=1"
        editable: false
```

### 2.5 NetworkPolicy (FR-N89.5)

```yaml
# infra/monitoring/victoriametrics/network-policy.yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: victoriametrics-network-policy
  namespace: monitoring
  annotations:
    csap.ref/d08: "접근통제 — VictoriaMetrics 접근을 monitoring NS 내부로 제한"
spec:
  podSelector:
    matchLabels:
      app: server
      app.kubernetes.io/name: victoria-metrics-single
  policyTypes:
    - Ingress
  ingress:
    # Prometheus remote_write 허용
    - from:
        - podSelector:
            matchLabels:
              app.kubernetes.io/name: prometheus
      ports:
        - protocol: TCP
          port: 8428
    # Grafana 쿼리 허용
    - from:
        - podSelector:
            matchLabels:
              app.kubernetes.io/name: grafana
      ports:
        - protocol: TCP
          port: 8428
```

### 2.6 리소스 제한 (FR-N89.6)

WSL2 환경 최적화 (전체 모니터링 스택 메모리 예산: 4Gi):

| 컴포넌트 | CPU req/limit | Memory req/limit |
|---------|--------------|-----------------|
| Prometheus | 500m / 1000m | 1Gi / 2Gi |
| VictoriaMetrics | 200m / 500m | 512Mi / 1Gi |
| Grafana | 200m / 500m | 256Mi / 512Mi |

### 2.7 셋업 스크립트 통합 (FR-N89.7)

기존 `scripts/setup-monitoring.sh`에 VictoriaMetrics 설치 단계 추가.

---

## 3. 보안 고려사항 (CSAP/N2SF)

| CSAP 항목 | 구현 방법 |
|----------|----------|
| D-06 침해사고관리 | 365일 메트릭 보존으로 감사 추적 기간 충족 |
| D-08 접근통제 | NetworkPolicy로 monitoring NS 내부만 접근 허용 |
| N2SF N-03 | 메트릭 데이터 = O등급 (서비스 성능 지표), AI API 전송 가능 |

---

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0.0 | 2026-04-10 | 최초 작성 | PM Lead |
