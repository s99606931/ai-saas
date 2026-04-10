# MTU-N239: KEDA Autoscaler 성능 모니터링 — Design

> **문서 ID**: MTU-N239-DESIGN
> **버전**: 1.0.0 | **작성일**: 2026-04-10
> **Plan 참조**: MTU-N239-PLAN

---

## Design Anchor

| 항목 | 선택 | 근거 |
|------|------|------|
| 메트릭 소스 | KEDA Operator /metrics | 기존 ServiceMonitor 활용 |
| 집계 방식 | PrometheusRule recording rules | 대시보드 쿼리 최적화 |

---

## §3.1 ScaledObject 메트릭

- `keda:scaledobject:active` — 활성 ScaledObject 수
- `keda:scaledobject:error_count` — 오류 ScaledObject 수
- `keda:scaling:rate5m` — 스케일링 이벤트 빈도

## §3.2 트리거 성능

- `keda:trigger:latency:p95` — 트리거 메트릭 수집 지연
- `keda:trigger:error:ratio` — 트리거 오류율

## §3.3 Operator 성능

- `keda:operator:reconcile:rate5m` — 재조정 빈도
- `keda:operator:reconcile:duration:p95` — 재조정 소요시간

## §3.4 리소스 사용량

- KEDA Operator 파드 CPU/메모리

## §3.5 알림 규칙 (5개)

| 알림명 | 조건 | 심각도 |
|--------|------|--------|
| KedaScaledObjectError | ScaledObject 오류 상태 | critical |
| KedaTriggerLatencyHigh | 트리거 지연 p95 > 10초 | warning |
| KedaOperatorReconcileSllow | 재조정 p95 > 30초 | warning |
| KedaScalingEventRateHigh | 스케일링 분당 20회 초과 | warning |
| KedaOperatorDown | KEDA Operator 파드 부재 | critical |

## §3.6 Grafana 대시보드

패널: ScaledObject 현황, 스케일링 이벤트 타임라인, 트리거 지연, Operator 성능, 리소스 사용량

---

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0.0 | 2026-04-10 | 최초 작성 | PM Lead |
