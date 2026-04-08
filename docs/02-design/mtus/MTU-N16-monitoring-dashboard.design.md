# MTU-N16: Grafana 모니터링 대시보드 완성 Design

| 항목 | 내용 |
|------|------|
| MTU ID | MTU-N16 |
| 버전 | 1.0.0 |
| 상태 | Approved |
| 작성일 | 2026-04-08 |
| 아키텍처 | Option B - Pragmatic Balance |

---

## Design Anchor

| 항목 | 내용 |
|------|------|
| Plan 참조 | docs/01-plan/mtus/MTU-N16-monitoring-dashboard.plan.md |
| 기존 자산 | k8s/monitoring/prometheus-alerts.yaml (14규칙), grafana-dashboard.json (10패널) |
| 기술 스택 | kube-prometheus-stack, Grafana 10.x, Prometheus 2.x, AlertManager |
| CSAP 매핑 | D-06 침해사고 관리, D-07 가용성, D-08 접근 통제 모니터링 |

---

## 아키텍처 선택

### Option A: 최소 보강 (기존 대시보드에 패널 추가만)
- 장점: 최소 변경, 빠른 완료
- 단점: SLO 체계 없음, 배포 매니페스트 없음

### Option B: Pragmatic Balance (선택)
- SLO 전용 대시보드 분리 + 보안 대시보드 분리 + 스택 배포 매니페스트
- 장점: 관심사 분리, CSAP 감리 대응 용이, 운영 즉시 가능
- 단점: 대시보드 3개 관리 필요

### Option C: 완전 자동화 (Grafana Operator + Dashboard CRD)
- 장점: GitOps 완전 통합
- 단점: 과잉 복잡도, k3s 리소스 부담

---

## 상세 설계

### DESIGN-SLO-1: API P95 응답시간 SLO 대시보드 (FR-N16.1)

```
패널 구성:
1. SLO 목표 대비 현재 P95 (Stat 패널)
   - expr: histogram_quantile(0.95, sum(rate(http_request_duration_seconds_bucket{namespace="saas-platform"}[5m])) by (le))
   - 목표선: 0.2 (200ms)
   - 색상: green < 0.2, orange 0.2~0.5, red > 0.5

2. 서비스별 P95 추이 (Timeseries 패널)
   - 서비스별 분리 표시, 200ms 목표선 overlay

3. P50/P95/P99 비교 (Timeseries 패널)
   - 3개 퍼센타일 동시 표시
```

### DESIGN-SLO-2: 가용성 99.9% SLO (FR-N16.2)

```
패널 구성:
4. 에러 버짓 소진율 (Gauge 패널)
   - expr: 1 - (sum(rate(http_requests_total{status=~"5.."}[30d])) / sum(rate(http_requests_total[30d])))
   - 목표: 0.999 (99.9%)
   - 에러 버짓 잔여량 표시

5. 30일 가용성 추이 (Timeseries 패널)
   - 일별 성공율 rolling average

6. 서비스별 가용성 테이블 (Table 패널)
   - 각 마이크로서비스별 가용성 수치
```

### DESIGN-SLO-3: SLO Burn Rate 알림 (FR-N16.3)

```yaml
# 4개 burn rate 알림 규칙:
- SLOLatencyBurnFast:  1h 창에서 14.4x burn → critical (2% 버짓 1시간 소진)
- SLOLatencyBurnSlow:  6h 창에서 6x burn → warning
- SLOAvailabilityBurnFast: 1h 창에서 14.4x burn → critical
- SLOAvailabilityBurnSlow: 6h 창에서 6x burn → warning
```

### DESIGN-SEC-1: CSAP D-06 보안 대시보드 (FR-N16.4)

```
5개 보안 패널:
1. 로그인 실패 히트맵 (시간대별 패턴)
   - expr: sum(increase(auth_login_failures_total[1h])) by (source_ip)
   - 브루트포스 패턴 시각화

2. Rate Limit (429) 추이
   - expr: sum(rate(http_requests_total{status="429"}[5m])) by (source_ip)
   - DDoS/오남용 패턴 감지

3. 이상 접근 패턴 (비정상 시간대 접근)
   - expr: sum(rate(http_requests_total[5m])) by (source_ip) filtered by 22:00~06:00

4. 감사 로그 볼륨 추이
   - expr: sum(rate(audit_events_total[5m])) by (action)
   - 민감 작업 빈도 모니터링

5. 데이터 등급별 API 호출 (N2SF)
   - expr: sum(rate(api_calls_total[5m])) by (data_grade)
   - C/S등급 데이터 접근 시도 모니터링
```

### DESIGN-OPS-1: 테넌트별 리소스 모니터링 (FR-N16.5)

```
기존 grafana-dashboard.json 보강:
- Grafana 템플릿 변수 추가: tenant (label selector)
- 모든 기존 패널에 tenant 필터 적용
- 신규 패널: 테넌트별 리소스 사용 비교 (Bar Chart)
```

### DESIGN-OPS-2: 디스크/PVC 사용률 (FR-N16.7)

```
패널 추가:
- PVC 사용률 게이지 (PostgreSQL, Redis, MinIO)
  - expr: kubelet_volume_stats_used_bytes / kubelet_volume_stats_capacity_bytes * 100
```

### DESIGN-STACK-1: kube-prometheus-stack 배포 (FR-N16.6)

```yaml
# k3s 최적화 구성:
- Prometheus: 256Mi request, 512Mi limit, 1Gi PV
- Grafana: 128Mi request, 256Mi limit, 대시보드 ConfigMap 마운트
- AlertManager: 64Mi request, 128Mi limit
- 네임스페이스: monitoring (saas-platform과 분리)
- ServiceMonitor: saas-platform 네임스페이스 스크래핑
```

### DESIGN-STACK-2: Alertmanager 라우팅 (FR-N16.8)

```yaml
# severity 기반 라우팅:
- critical → webhook (즉시 알림)
- warning → webhook (5분 그룹)
- 한국어 알림 템플릿
- 반복 알림 간격: critical 10분, warning 1시간
```

---

## Session Guide

```
1단계: prometheus-stack.yaml 생성 (Prometheus+Grafana+AlertManager)
2단계: SLO 대시보드 JSON 생성 (6패널)
3단계: 보안 대시보드 JSON 생성 (5패널)
4단계: 기존 운영 대시보드 보강 (테넌트 변수, PVC 패널)
5단계: prometheus-alerts.yaml에 burn rate 4개 추가
6단계: 검증 (JSON/YAML 유효성)
```

---

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0.0 | 2026-04-08 | 초안 작성 | PM Lead Agent |
