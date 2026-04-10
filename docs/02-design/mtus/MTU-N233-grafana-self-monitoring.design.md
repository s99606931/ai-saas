# MTU-N233: Grafana 자체 성능 모니터링 — Design

> **문서 버전**: 1.0.0
> **작성일**: 2026-04-10
> **Plan 참조**: `docs/01-plan/mtus/MTU-N233-grafana-self-monitoring.plan.md`

---

## Design Anchor

| 항목 | 결정 |
|------|------|
| 아키텍처 | Grafana 내장 `grafana_*` 메트릭 활용 |
| 메트릭 소스 | `grafana_http_request_*`, `grafana_datasource_*`, `grafana_api_*` |
| 알림 전략 | warning(5m) → critical(10m) |
| 대시보드 | 4행: API 성능 | 데이터소스 | 인증 | 리소스 |

---

## §1 상세 설계

### §1.1 API 응답 성능 (FR-N233.1)
- `grafana:api:request_duration_p99` — API p99 지연
- `grafana:api:error_rate` — API 5xx 에러율

### §1.2 데이터소스 연결 (FR-N233.2)
- `GrafanaDatasourceDown` — 데이터소스 연결 실패 알림
- `GrafanaNotRunning` — Grafana 파드 미실행

### §1.3 인증 모니터링 (FR-N233.3)
- `grafana:auth:login_attempts_rate` — 로그인 시도 비율
- `grafana:auth:login_failures_rate` — 로그인 실패 비율

### §1.4 리소스 (FR-N233.4)
- `GrafanaMemoryHigh` — 메모리 > 512MB
- `GrafanaCPUHigh` — CPU > 500m

---

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0.0 | 2026-04-10 | 최초 작성 | PM 에이전트 |
