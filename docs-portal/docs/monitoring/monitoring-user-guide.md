---
sidebar_position: 1
title: 통합 모니터링 사용자 가이드
description: Prometheus + Grafana + Loki + Tempo — 모든 서비스를 한눈에 모니터링
---

# 통합 모니터링 사용자 가이드

> **대상 독자**: 초급(모니터링 처음 접하는 분) ~ 중급(커스터마이징 필요한 분)
> **환경**: WSL2 + k3s + LGTM Stack (Loki, Grafana, Tempo, Mimir/Prometheus)
> **CSAP 준수**: D-06(감사 로그), D-08(접근 통제 모니터링), D-12(PII 마스킹)

---

## 목차

1. [모니터링이란?](#1-모니터링이란)
2. [전체 아키텍처](#2-전체-아키텍처)
3. [원클릭 설치](#3-원클릭-설치)
4. [Grafana 접속 및 기본 사용법](#4-grafana-접속-및-기본-사용법)
5. [대시보드 사용법](#5-대시보드-사용법)
6. [메트릭 조회 (Prometheus)](#6-메트릭-조회-prometheus)
7. [로그 조회 (Loki)](#7-로그-조회-loki)
8. [분산 추적 (Tempo)](#8-분산-추적-tempo)
9. [알림 설정 (AlertManager)](#9-알림-설정-alertmanager)
10. [서비스 자동 계측 (OpenTelemetry)](#10-서비스-자동-계측-opentelemetry)
11. [커스텀 대시보드 만들기](#11-커스텀-대시보드-만들기)
12. [문제 해결 가이드](#12-문제-해결-가이드)

---

## 1. 모니터링이란?

### 1.1 왜 모니터링이 필요한가?

모니터링은 시스템의 **건강 상태를 실시간으로 파악**하는 것입니다.

- **장애 예방**: CPU/메모리 과다 사용을 미리 감지하여 조치
- **장애 진단**: 문제 발생 시 원인을 빠르게 파악
- **성능 최적화**: 병목 구간을 찾아 개선
- **규제 준수**: CSAP D-06 감사 로그 수집 및 보존 의무

### 1.2 4가지 모니터링 신호 (Four Golden Signals)

| 신호 | 설명 | 도구 |
|------|------|------|
| **메트릭** (Metrics) | 숫자 시계열 데이터 (CPU, 메모리, 요청 수) | Prometheus |
| **로그** (Logs) | 텍스트 이벤트 기록 | Loki + Promtail |
| **추적** (Traces) | 요청의 서비스 간 흐름 추적 | Tempo + OTel |
| **알림** (Alerts) | 이상 감지 시 자동 통보 | AlertManager |

### 1.3 우리 시스템의 모니터링 스택

```
┌─────────────────────────────────────────────┐
│               Grafana (시각화)               │
│  대시보드 | 로그 탐색 | 추적 뷰어 | 알림    │
└────┬──────────┬──────────┬──────────┬───────┘
     │          │          │          │
┌────┴───┐ ┌───┴────┐ ┌───┴────┐ ┌───┴─────┐
│Promethe│ │  Loki  │ │ Tempo  │ │ Alert   │
│us      │ │ (로그) │ │(추적)  │ │ Manager │
│(메트릭)│ │        │ │        │ │ (알림)  │
└────┬───┘ └───┬────┘ └───┬────┘ └─────────┘
     │         │          │
┌────┴─────────┴──────────┴──────────────────┐
│         OpenTelemetry Collector             │
│    (메트릭 + 로그 + 추적 통합 수집)         │
└────────────────┬───────────────────────────┘
                 │
┌────────────────┴───────────────────────────┐
│          k3s 클러스터 내 서비스들           │
│  API Gateway | Auth | User | Tenant | ...  │
└────────────────────────────────────────────┘
```

---

## 2. 전체 아키텍처

### 2.1 컴포넌트 역할

| 컴포넌트 | 역할 | 데이터 보존 | 접속 |
|---------|------|-----------|------|
| **Prometheus** | 메트릭 수집 및 저장 | 30일 | `http://localhost:30090` |
| **Grafana** | 시각화 대시보드 | 영구 | `http://localhost:30300` |
| **Loki** | 로그 집계 | 30일 | Grafana 경유 |
| **Promtail** | Pod 로그 수집 에이전트 | 없음 (전달만) | 자동 |
| **Tempo** | 분산 추적 데이터 저장 | 7일 | Grafana 경유 |
| **OTel Collector** | 텔레메트리 데이터 통합 수집/처리 | 없음 (전달만) | 자동 |
| **AlertManager** | 알림 라우팅 및 전송 | 메모리 | `http://localhost:30093` |
| **Node Exporter** | 노드(서버) 하드웨어 메트릭 | 없음 | 자동 |
| **kube-state-metrics** | k8s 오브젝트 상태 메트릭 | 없음 | 자동 |
| **Blackbox Exporter** | 외부 URL 가용성 모니터링 | 없음 | 자동 |
| **PostgreSQL Exporter** | DB 성능 메트릭 | 없음 | 자동 |
| **Redis Exporter** | 캐시 성능 메트릭 | 없음 | 자동 |

### 2.2 데이터 흐름

```
[메트릭 흐름]
  Node Exporter → Prometheus 스크랩 (15초 주기) → Grafana 시각화
  kube-state-metrics → Prometheus → Grafana
  PostgreSQL Exporter → Prometheus → Grafana
  Blackbox Exporter → Prometheus → Grafana

[로그 흐름]
  Pod 표준 출력 → Promtail 수집 → OTel Collector (PII 마스킹) → Loki → Grafana

[추적 흐름]
  앱 SDK → OTel Collector (샘플링) → Tempo → Grafana
```

---

## 3. 원클릭 설치

### 3.1 설치 명령

```bash
# 전체 모니터링 스택 설치 (약 10~15분)
./scripts/setup-monitoring.sh

# 또는 수동으로 setup-observability.sh 사용
./scripts/setup-observability.sh install
```

### 3.2 설치 과정

스크립트가 자동으로 9단계를 실행합니다:

| 단계 | 컴포넌트 | 소요 시간 |
|------|---------|----------|
| 1/9 | 사전 조건 확인 | 5초 |
| 2/9 | Helm 저장소 등록 | 10초 |
| 3/9 | 네임스페이스 + 시크릿 | 5초 |
| 4/9 | kube-prometheus-stack | 3~5분 |
| 5/9 | Loki | 1~2분 |
| 6/9 | Promtail | 30초 |
| 7/9 | Tempo | 1분 |
| 8/9 | OTel Operator + Collector | 2~3분 |
| 9/9 | Exporters (Blackbox, PG, Redis) | 1분 |

### 3.3 설치 확인

```bash
# Pod 상태 확인
kubectl get pods -n monitoring

# 기대 결과 (모두 Running):
# kube-prometheus-stack-grafana-xxx          Running
# kube-prometheus-stack-prometheus-xxx       Running
# alertmanager-kube-prometheus-stack-xxx     Running
# kube-prometheus-stack-kube-state-metrics   Running
# kube-prometheus-stack-prometheus-node-xxx  Running
# loki-0                                    Running
# promtail-xxx                              Running
# tempo-0                                   Running
# opentelemetry-operator-xxx                Running
# saas-otel-collector-xxx                   Running
# blackbox-exporter-xxx                     Running
```

### 3.4 설치 후 접속 정보

| 서비스 | URL | 비고 |
|--------|-----|------|
| Grafana | `http://localhost:30300` | ID: admin / PW: 설치 시 출력됨 |
| Prometheus | `http://localhost:30090` | 메트릭 직접 조회 |
| AlertManager | `http://localhost:30093` | 알림 상태 확인 |

---

## 4. Grafana 접속 및 기본 사용법

### 4.1 첫 로그인

1. 브라우저에서 `http://localhost:30300` 접속
2. 로그인 화면에서 ID와 비밀번호 입력
   - ID: `admin`
   - PW: 설치 시 콘솔에 출력된 비밀번호
3. 로그인 후 비밀번호 변경 권장

:::tip 비밀번호를 분실했다면
```bash
# Grafana 관리자 비밀번호 확인
kubectl get secret grafana-admin-secret -n monitoring \
  -o jsonpath='{.data.admin-password}' | base64 -d && echo
```
:::

### 4.2 메인 화면 구성

로그인 후 좌측 메뉴:

| 메뉴 | 기능 |
|------|------|
| **Home** | 최근 대시보드, 즐겨찾기 |
| **Dashboards** | 사전 구성된 대시보드 목록 |
| **Explore** | 메트릭/로그/추적 자유 조회 |
| **Alerting** | 알림 규칙 및 알림 이력 |
| **Connections** | 데이터소스 설정 |

### 4.3 데이터소스 확인

자동 등록된 데이터소스 3개를 확인합니다:

1. 좌측 메뉴 `Connections` > `Data sources` 클릭
2. 다음 3개가 있어야 합니다:
   - **Prometheus** (메트릭)
   - **Loki** (로그)
   - **Tempo** (추적)

---

## 5. 대시보드 사용법

### 5.1 사전 구성된 대시보드

설치 시 다음 대시보드가 자동으로 생성됩니다:

| 대시보드 | 내용 | 경로 |
|---------|------|------|
| **클러스터 개요** | CPU, 메모리, Pod 수, 네임스페이스별 상태 | Public SaaS > 클러스터 개요 |
| **서비스 RED 메트릭** | Rate, Error, Duration + 서비스 맵 | Public SaaS > 서비스 RED 메트릭 |
| **노드 상세 모니터링** | CPU 코어별, 디스크 I/O, 네트워크 | Public SaaS > 노드 상세 모니터링 |
| **SQL 모니터링** | 슬로우쿼리, 인덱스, 커넥션 | Public SaaS > SQL 모니터링 |
| **서비스 트래픽** | HTTP 트래픽, 응답 코드 분포 | Public SaaS > 서비스 트래픽 |
| **GitOps 상태** | Flux 배포 상태, 동기화 이력 | Public SaaS > GitOps 상태 |
| **로그 탐색기** | 서비스별 로그 검색 | Public SaaS > 로그 탐색기 |

### 5.2 대시보드 접근 방법

1. 좌측 메뉴 `Dashboards` 클릭
2. `Public SaaS` 폴더 클릭
3. 원하는 대시보드 선택

### 5.3 시간 범위 변경

- 우측 상단의 시간 선택기 (기본: `Last 1 hour`)
- 자주 사용하는 범위: `Last 15 minutes`, `Last 1 hour`, `Last 6 hours`, `Last 24 hours`
- 커스텀 범위: `Custom time range` 클릭 후 시작/종료 시간 지정

### 5.4 자동 새로고침

- 우측 상단 새로고침 아이콘 옆 드롭다운
- 권장 설정: `10s` (실시간 모니터링 시) 또는 `1m` (일반 사용)

---

## 6. 메트릭 조회 (Prometheus)

### 6.1 Explore 모드에서 메트릭 조회

1. 좌측 메뉴 `Explore` 클릭
2. 상단 데이터소스를 `Prometheus` 선택
3. 쿼리 입력란에 PromQL 입력

### 6.2 자주 사용하는 PromQL 쿼리

```promql
# CPU 사용률 (%)
100 - (avg(rate(node_cpu_seconds_total{mode="idle"}[5m])) * 100)

# 메모리 사용률 (%)
(1 - node_memory_MemAvailable_bytes / node_memory_MemTotal_bytes) * 100

# Pod 수
count(kube_pod_info)

# 네임스페이스별 Pod 상태
count by (namespace, phase) (kube_pod_status_phase)

# 서비스별 요청률 (초당)
sum by (client) (rate(traces_service_graph_request_total[5m]))

# 서비스별 에러율 (%)
sum by (client) (rate(traces_service_graph_request_failed_total[5m]))
/ sum by (client) (rate(traces_service_graph_request_total[5m])) * 100

# 서비스별 P99 레이턴시
histogram_quantile(0.99, sum by (client, le)
  (rate(traces_service_graph_request_duration_seconds_bucket[5m])))

# 디스크 여유 공간 (%)
(node_filesystem_avail_bytes{mountpoint="/"} / node_filesystem_size_bytes{mountpoint="/"}) * 100

# PostgreSQL 활성 연결 수
pg_stat_activity_count

# Redis 메모리 사용량
redis_memory_used_bytes / 1024 / 1024
```

### 6.3 PromQL 기본 문법

| 함수 | 설명 | 예시 |
|------|------|------|
| `rate()` | 초당 변화율 | `rate(http_requests_total[5m])` |
| `sum()` | 합계 | `sum(container_cpu_usage)` |
| `avg()` | 평균 | `avg(node_memory_usage)` |
| `by ()` | 그룹화 | `sum by (namespace) (...)` |
| `histogram_quantile()` | 백분위수 | `histogram_quantile(0.95, ...)` |
| `count()` | 개수 | `count(kube_pod_info)` |
| `increase()` | 증가량 | `increase(errors_total[1h])` |

---

## 7. 로그 조회 (Loki)

### 7.1 Explore 모드에서 로그 조회

1. 좌측 메뉴 `Explore` 클릭
2. 상단 데이터소스를 `Loki` 선택
3. LogQL 쿼리 입력

### 7.2 자주 사용하는 LogQL 쿼리

```logql
# 특정 네임스페이스의 모든 로그
{namespace="saas-platform"}

# 특정 서비스 로그
{namespace="saas-platform", app="api-gateway"}

# 에러 로그만 필터
{namespace="saas-platform"} |= "error"

# JSON 로그 파싱 후 필터
{namespace="saas-platform"} | json | level="ERROR"

# 로그 발생 빈도 (분당)
count_over_time({namespace="saas-platform"} |= "error" [1m])

# 특정 사용자의 활동 로그
{namespace="saas-platform"} |= "user_id=12345"

# 모니터링 시스템 자체 로그
{namespace="monitoring"}
```

### 7.3 로그에서 추적으로 이동

Loki에서 로그를 조회하면, traceId가 포함된 로그에 **Tempo 링크**가 자동으로 표시됩니다.
클릭하면 해당 요청의 전체 추적을 Tempo에서 확인할 수 있습니다.

---

## 8. 분산 추적 (Tempo)

### 8.1 추적이란?

분산 추적은 하나의 사용자 요청이 **여러 마이크로서비스를 거치는 과정**을 시각화합니다.

```
사용자 요청 → API Gateway → Auth Service → User Service → DB
                    ↓
              Audit Service
```

### 8.2 Explore 모드에서 추적 조회

1. 좌측 메뉴 `Explore` 클릭
2. 데이터소스를 `Tempo` 선택
3. 검색 방법:
   - **Search**: 서비스명, 상태 코드 등으로 검색
   - **TraceQL**: 쿼리 언어로 검색
   - **Service Graph**: 서비스 간 관계 시각화

### 8.3 TraceQL 예시

```traceql
# 특정 서비스의 에러 추적
{resource.service.name="api-gateway" && status=error}

# 500ms 이상 걸린 요청
{duration > 500ms}

# 특정 HTTP 메서드의 추적
{span.http.method="POST" && span.http.status_code=500}
```

### 8.4 서비스 맵 (Service Graph)

Tempo의 **Service Graph** 기능으로 서비스 간 호출 관계를 시각적으로 확인할 수 있습니다.

1. Explore → Tempo 선택
2. 탭을 `Service Graph`로 전환
3. 노드(서비스) 간 연결선과 요청률/에러율 표시

---

## 9. 알림 설정 (AlertManager)

### 9.1 사전 구성된 알림

| 알림 이름 | 조건 | 심각도 |
|---------|------|--------|
| HighCPUUsage | CPU 80% 초과 5분 지속 | warning |
| HighMemoryUsage | 메모리 85% 초과 5분 지속 | warning |
| PodCrashLooping | 15분 내 5회 이상 재시작 | critical |
| PodNotReady | 5분 이상 NotReady | warning |
| DiskSpaceRunningLow | 디스크 여유 15% 미만 | warning |
| DiskSpaceCritical | 디스크 여유 5% 미만 | critical |
| ServiceDown | Blackbox 프로브 2분 실패 | critical |
| SlowQueryDetected | SQL 5초 초과 쿼리 | warning |
| HighServiceErrorRate | 에러율 1% 초과 5분 지속 | critical |
| FluxReconcileFailure | Flux 동기화 5분 실패 | critical |

### 9.2 알림 확인 방법

```bash
# AlertManager 웹 UI 접속
http://localhost:30093

# 또는 Grafana에서 확인
# 좌측 메뉴 → Alerting → Alert rules
```

### 9.3 알림 수신 설정 (웹훅)

AlertManager 설정 파일(`kube-prometheus-stack/values.yaml`)의 `receivers` 섹션에 웹훅 URL을 추가합니다.

---

## 10. 서비스 자동 계측 (OpenTelemetry)

### 10.1 자동 계측이란?

OpenTelemetry 자동 계측은 **코드 변경 없이** 메트릭, 로그, 추적 데이터를 수집합니다.
Pod에 annotation을 추가하면 자동으로 계측 에이전트가 주입됩니다.

### 10.2 계측 활성화 방법

```bash
# Node.js 서비스 자동 계측
kubectl annotate pod <pod-name> \
  instrumentation.opentelemetry.io/inject-nodejs="true" \
  -n saas-platform

# 또는 Deployment에 적용 (모든 Pod에 자동 적용)
kubectl patch deployment api-gateway -n saas-platform \
  -p '{"spec":{"template":{"metadata":{"annotations":{"instrumentation.opentelemetry.io/inject-nodejs":"true"}}}}}'
```

### 10.3 계측 확인

```bash
# Pod에 init container가 추가되었는지 확인
kubectl describe pod <pod-name> -n saas-platform | grep "Init Containers" -A 5
# opentelemetry-auto-instrumentation 컨테이너가 보여야 합니다
```

---

## 11. 커스텀 대시보드 만들기

### 11.1 Grafana에서 대시보드 생성

1. `Dashboards` > `New` > `New Dashboard` 클릭
2. `Add visualization` 클릭
3. 데이터소스 선택 (Prometheus/Loki/Tempo)
4. 쿼리 입력 및 시각화 유형 선택
5. `Save` 클릭

### 11.2 대시보드를 ConfigMap으로 저장

Grafana에서 만든 대시보드를 Git으로 관리하려면:

1. 대시보드 설정(톱니바퀴) → `JSON model` 복사
2. `infra/monitoring/dashboards/` 디렉토리에 YAML 파일 생성
3. ConfigMap 형태로 JSON 삽입

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: my-custom-dashboard
  namespace: monitoring
  labels:
    grafana_dashboard: "1"
data:
  my-dashboard.json: |
    { ... 복사한 JSON ... }
```

4. 적용: `kubectl apply -f infra/monitoring/dashboards/my-custom-dashboard.yaml -n monitoring`

---

## 12. 문제 해결 가이드

### 12.1 Grafana에 접속이 안 됩니다

```bash
# Pod 상태 확인
kubectl get pods -n monitoring -l app.kubernetes.io/name=grafana

# Pod가 Running이 아니면 로그 확인
kubectl logs -n monitoring -l app.kubernetes.io/name=grafana

# NodePort 확인
kubectl get svc -n monitoring | grep grafana
# 30300 포트가 보여야 합니다
```

### 12.2 메트릭이 수집되지 않습니다

```bash
# Prometheus 타겟 확인
http://localhost:30090/targets
# 모든 타겟이 "UP" 상태여야 합니다

# ServiceMonitor 확인
kubectl get servicemonitor -n monitoring
```

### 12.3 로그가 보이지 않습니다

```bash
# Promtail 상태 확인
kubectl get pods -n monitoring -l app.kubernetes.io/name=promtail
kubectl logs -n monitoring -l app.kubernetes.io/name=promtail

# Loki 상태 확인
kubectl get pods -n monitoring -l app.kubernetes.io/name=loki
```

### 12.4 메모리 부족 (OOM)

```bash
# 각 컴포넌트 메모리 사용량 확인
kubectl top pods -n monitoring

# 가장 메모리를 많이 사용하는 것 확인 후
# values.yaml에서 리소스 제한 조정
```

### 12.5 모니터링 재설치

```bash
# 전체 제거
./scripts/setup-monitoring.sh --uninstall

# 재설치
./scripts/setup-monitoring.sh
```

---

## 부록: 자주 사용하는 명령어

```bash
# === 상태 확인 ===
kubectl get pods -n monitoring                         # 모든 모니터링 Pod
kubectl top pods -n monitoring                         # 리소스 사용량
./scripts/setup-monitoring.sh --status                # 전체 상태 요약

# === 대시보드 ===
./scripts/setup-monitoring.sh --dashboards             # 대시보드 업데이트

# === 로그 확인 ===
kubectl logs -f -n monitoring -l app.kubernetes.io/name=grafana
kubectl logs -f -n monitoring -l app.kubernetes.io/name=prometheus

# === Prometheus ===
curl -s http://localhost:30090/api/v1/targets | jq '.data.activeTargets | length'

# === 제거 ===
./scripts/setup-monitoring.sh --uninstall
```

---

*이 문서는 MTU-N36 통합 모니터링 시스템의 사용자 가이드입니다.*
*CSAP D-06/D-08/D-12 요건을 준수합니다.*
