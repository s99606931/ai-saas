# MTU-N229: Loki 로그 수집 파이프라인 모니터링 — Design

> **문서 버전**: 1.0.0
> **작성일**: 2026-04-10
> **작성자**: PM 에이전트
> **Plan 참조**: `docs/01-plan/mtus/MTU-N229-loki-log-pipeline.plan.md`

---

## Executive Summary

| 관점 | 설계 결정 |
|------|----------|
| 비즈니스 | Loki 로그 파이프라인 전체 가시성 확보 — 수집→저장→쿼리 전 구간 모니터링 |
| 기술 | Prometheus Recording/Alert Rules + Grafana 대시보드 (Loki/Promtail 내장 메트릭 활용) |
| 보안 | CSAP D-06 로그 무결성: 드롭률/누락 알림으로 로그 완전성 보장 |
| 운영 | SLO 기반 다단계 알림 (warning → critical), 런북 자동 링크 |

---

## Design Anchor

| 항목 | 결정 |
|------|------|
| 아키텍처 | Pragmatic Balance — Loki/Promtail 내장 메트릭 기반, 추가 익스포터 없음 |
| 메트릭 소스 | `loki_*` (Loki), `promtail_*` (Promtail) Prometheus 메트릭 |
| 알림 전략 | 2단계: warning(5m) → critical(15m), severity 기반 라우팅 |
| 대시보드 | 단일 대시보드: 수집률, 드롭률, 지연, 스토리지, 쿼리 성능 통합 |

---

## §1 상세 설계

### §1.1 Loki Ingester 수집률/드롭률 모니터링 (FR-N229.1)

**Recording Rules**:
- `loki:ingester:lines_received_rate5m` — 5분간 Loki 수신 라인 비율
- `loki:ingester:lines_dropped_rate5m` — 5분간 드롭된 라인 비율
- `loki:ingester:drop_ratio` — 드롭률 (드롭/수신 비율)

**핵심 메트릭**:
- `loki_distributor_lines_received_total` — 수신 로그 라인 수
- `loki_distributor_bytes_received_total` — 수신 바이트 수
- `loki_ingester_chunk_entries` — 청크 내 엔트리 수

### §1.2 Promtail 수집 에이전트 상태 (FR-N229.2)

**Alert Rules**:
- `PromtailTargetsDown` — Promtail 수집 대상 감소 (warning)
- `PromtailRequestLatencyHigh` — Loki 전송 지연 p99 > 5초 (warning)
- `PromtailRequestErrors` — Loki 전송 실패율 > 1% (critical)
- `PromtailNotRunning` — Promtail 파드 미실행 (critical)

**핵심 메트릭**:
- `promtail_targets_active_total` — 활성 수집 대상 수
- `promtail_request_duration_seconds` — Loki 전송 지연
- `promtail_sent_bytes_total` — 전송 바이트 수
- `promtail_dropped_bytes_total` — 드롭 바이트 수

### §1.3 Loki 스토리지/압축 (FR-N229.3)

**Recording Rules**:
- `loki:storage:bytes_total` — 전체 스토리지 사용량
- `loki:compactor:compaction_duration_avg` — 평균 압축 소요 시간
- `loki:retention:bytes_freed_rate` — 리텐션 정책 삭제량

**핵심 메트릭**:
- `loki_ingester_memory_chunks` — 메모리 내 활성 청크 수
- `loki_compactor_apply_retention_sweeps_total` — 리텐션 스윕 수

### §1.4 Loki 쿼리 성능 (FR-N229.4)

**Alert Rules**:
- `LokiQuerySlowP99` — 쿼리 p99 지연 > 10초 (warning)
- `LokiQueryTimeout` — 쿼리 타임아웃 발생 (critical)
- `LokiQueryQueueFull` — 쿼리 큐 포화 (warning)

**핵심 메트릭**:
- `loki_request_duration_seconds` — 쿼리 지연 시간
- `loki_query_frontend_retries_total` — 쿼리 재시도 수

### §1.5 Grafana 대시보드 (FR-N229.5)

**패널 구성** (4행):
1. **수집 현황**: 수신 라인/초, 전송 바이트/초, 활성 타겟 수
2. **드롭/에러**: 드롭률, 전송 실패율, Promtail 에러
3. **스토리지**: 활성 청크, 스토리지 사용량, 압축 효율
4. **쿼리 성능**: 쿼리 지연 p50/p99, 타임아웃, 큐 깊이

### §1.6 알림 통합 (FR-N229.6)

**심각도 분류**:
- `critical`: 로그 수집 완전 중단, 전송 실패율 > 5%, Promtail 다운
- `warning`: 드롭률 > 0.1%, 전송 지연 > 5초, 쿼리 느림

---

## §2 CSAP 매핑

| CSAP 항목 | 구현 내용 |
|-----------|----------|
| D-06-01 | 로그 수집 파이프라인 가용성 모니터링 |
| D-06-03 | 로그 누락/드롭 탐지 알림 |
| D-06-04 | 로그 스토리지 보존 정책 모니터링 |

---

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0.0 | 2026-04-10 | 최초 작성 | PM 에이전트 |
