# MTU-N231: Prometheus 자체 성능/리소스 모니터링 — Design

> **문서 버전**: 1.0.0
> **작성일**: 2026-04-10
> **Plan 참조**: `docs/01-plan/mtus/MTU-N231-prometheus-self-monitoring.plan.md`

---

## Design Anchor

| 항목 | 결정 |
|------|------|
| 아키텍처 | Prometheus 내장 `prometheus_*` 메트릭 활용 (자기 수집) |
| 메트릭 소스 | `prometheus_tsdb_*`, `prometheus_target_*`, `prometheus_rule_*`, `process_*` |
| 알림 전략 | warning(5m) → critical(15m), TSDB 임계값 기반 |
| 대시보드 | 4행: 스크랩 | TSDB/WAL | 규칙 평가 | 리소스 |

---

## §1 상세 설계

### §1.1 스크랩 성능 (FR-N231.1)

**Recording Rules**:
- `prometheus:scrape:success_ratio` — 스크랩 성공률
- `prometheus:scrape:duration_p99` — 스크랩 지연 p99
- `prometheus:target:active_count` — 활성 스크랩 대상 수
- `prometheus:scrape:samples_rate` — 초당 수집 샘플 수

### §1.2 TSDB 성능 (FR-N231.2)

**Recording Rules**:
- `prometheus:tsdb:head_series` — 헤드 시리즈 수
- `prometheus:tsdb:head_chunks` — 헤드 청크 수
- `prometheus:tsdb:wal_size_bytes` — WAL 크기
- `prometheus:tsdb:compaction_duration` — TSDB 압축 시간

### §1.3 규칙 평가 (FR-N231.3)

**Alert Rules**:
- `PrometheusRuleEvaluationSlow` — 규칙 평가 지연 > 10초
- `PrometheusRuleFailures` — 규칙 평가 실패 발생

### §1.4 리소스 사용량 (FR-N231.4)

**Alert Rules**:
- `PrometheusMemoryHigh` — 메모리 > 2GB
- `PrometheusTSDBFull` — TSDB 용량 70% 초과 (사전 경고)
- `PrometheusNotRunning` — Prometheus 서버 미실행

---

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0.0 | 2026-04-10 | 최초 작성 | PM 에이전트 |
