# MTU-N234: OTel Collector 성능 모니터링 — Design

> **문서 버전**: 1.0.0
> **작성일**: 2026-04-10
> **Plan 참조**: `docs/01-plan/mtus/MTU-N234-otel-collector-monitoring.plan.md`

---

## Design Anchor

| 항목 | 결정 |
|------|------|
| 아키텍처 | OTel Collector 내장 `otelcol_*` 메트릭 활용 |
| 메트릭 소스 | `otelcol_receiver_*`, `otelcol_processor_*`, `otelcol_exporter_*` |
| 알림 전략 | warning(5m) → critical(10m) |

---

## §1 상세 설계

### §1.1 수신 성능 (FR-N234.1)
- `otelcol:receiver:accepted_rate` — 수신 허용 데이터 포인트/초
- `otelcol:receiver:refused_rate` — 수신 거부 데이터 포인트/초

### §1.2 처리 파이프라인 (FR-N234.2)
- `otelcol:processor:dropped_rate` — 프로세서 드롭 비율
- `otelcol:processor:batch_size_avg` — 배치 평균 크기

### §1.3 내보내기 성능 (FR-N234.3)
- `otelcol:exporter:sent_rate` — 내보내기 성공률
- `otelcol:exporter:failed_rate` — 내보내기 실패율
- `OtelCollectorExporterFailing` — 실패율 > 1% 알림

### §1.4 리소스 (FR-N234.4)
- `OtelCollectorNotRunning` — 파드 미실행
- `OtelCollectorMemoryHigh` — 메모리 경고

---

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0.0 | 2026-04-10 | 최초 작성 | PM 에이전트 |
