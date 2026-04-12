# MTU-N230: Tempo 분산 추적 성능 모니터링 — Design

> **문서 버전**: 1.0.0
> **작성일**: 2026-04-10
> **작성자**: PM 에이전트
> **Plan 참조**: `docs/01-plan/mtus/MTU-N230-tempo-tracing-perf.plan.md`

---

## Executive Summary

| 관점 | 설계 결정 |
|------|----------|
| 비즈니스 | Tempo 분산 추적 전체 성능 가시성 — 수집→저장→쿼리→압축 전 구간 |
| 기술 | Tempo 내장 `tempo_*` 메트릭 활용, 추가 익스포터 불필요 |
| 보안 | CSAP D-06 트레이스 무결성 보장: 수집 드롭/중단 알림 |
| 운영 | 2단계 알림 + WAL 크기 사전 경고 |

---

## Design Anchor

| 항목 | 결정 |
|------|------|
| 아키텍처 | Pragmatic Balance — Tempo 내장 메트릭 기반 |
| 메트릭 소스 | `tempo_ingester_*`, `tempo_querier_*`, `tempo_compactor_*`, `tempo_distributor_*` |
| 알림 전략 | warning(5m) → critical(10m) |
| 대시보드 | 단일 대시보드: 수집률, WAL, 쿼리 성능, 압축 효율 통합 |

---

## §1 상세 설계

### §1.1 Tempo Ingester 수집 성능 (FR-N230.1)

**Recording Rules**:
- `tempo:ingester:traces_received_rate5m` — 5분간 트레이스 수신 비율
- `tempo:ingester:spans_received_rate5m` — 5분간 스팬 수신 비율
- `tempo:ingester:bytes_received_rate5m` — 수신 바이트 비율
- `tempo:distributor:spans_dropped_rate5m` — 드롭 스팬 비율

### §1.2 쿼리 성능 (FR-N230.2)

**Alert Rules**:
- `TempoQuerySlowP99` — TraceQL 쿼리 p99 > 5초
- `TempoQueryErrors` — 쿼리 에러율 > 1%
- `TempoNotRunning` — Tempo 파드 미실행

### §1.3 WAL/스토리지 (FR-N230.3)

**Recording Rules**:
- `tempo:wal:size_bytes` — WAL 크기
- `tempo:storage:block_count` — 저장 블록 수
- `tempo:ingester:live_traces` — 활성 트레이스 수

### §1.4 Compactor 성능 (FR-N230.4)

**Recording Rules**:
- `tempo:compactor:compaction_duration` — 압축 소요 시간
- `tempo:compactor:blocks_compacted_rate` — 압축 블록 비율

### §1.5 대시보드 (FR-N230.5)

4행 구성: 수집 현황 | WAL/스토리지 | 쿼리 성능 | 압축/리소스

### §1.6 알림 통합 (FR-N230.6)

critical: Tempo 다운, 수집 중단, 쿼리 에러 급증
warning: 쿼리 느림, WAL 증가, 드롭률 상승

---

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0.0 | 2026-04-10 | 최초 작성 | PM 에이전트 |
