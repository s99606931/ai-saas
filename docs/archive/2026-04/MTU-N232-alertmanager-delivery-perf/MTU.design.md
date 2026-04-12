# MTU-N232: AlertManager 알림 전달 성능 모니터링 — Design

> **문서 버전**: 1.0.0
> **작성일**: 2026-04-10
> **Plan 참조**: `docs/01-plan/mtus/MTU-N232-alertmanager-delivery-perf.plan.md`

---

## Design Anchor

| 항목 | 결정 |
|------|------|
| 아키텍처 | AlertManager 내장 `alertmanager_*` 메트릭 활용 |
| 메트릭 소스 | `alertmanager_notifications_*`, `alertmanager_alerts_*`, `alertmanager_silences_*` |
| 알림 전략 | 전달 실패 = critical (2m), 전달 지연 = warning (5m) |
| 대시보드 | 4행: 전달 성공/실패 | 전달 지연 | 억제/무음 | 클러스터 상태 |

---

## §1 상세 설계

### §1.1 알림 전달 성공률/실패율 (FR-N232.1)

**Recording Rules**:
- `alertmanager:notifications:success_rate5m` — 전달 성공률
- `alertmanager:notifications:failure_rate5m` — 전달 실패율
- `alertmanager:notifications:total_rate5m` — 전체 전달 시도율

### §1.2 알림 전달 지연 (FR-N232.2)

**Recording Rules**:
- `alertmanager:notification:latency_p99` — 전달 지연 p99
- `alertmanager:notification:latency_p50` — 전달 지연 p50

### §1.3 억제/무음 현황 (FR-N232.3)

**Recording Rules**:
- `alertmanager:alerts:active_count` — 활성 알림 수
- `alertmanager:alerts:suppressed_count` — 억제된 알림 수
- `alertmanager:silences:active_count` — 활성 무음 규칙 수

### §1.4 AlertManager 자체 상태 (FR-N232.4)

**Alert Rules**:
- `AlertManagerNotRunning` — AM 파드 미실행
- `AlertManagerNotificationFailing` — 전달 실패율 > 1%
- `AlertManagerHighLatency` — 전달 지연 p99 > 30초
- `AlertManagerClusterDown` — 클러스터 피어 연결 실패

---

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0.0 | 2026-04-10 | 최초 작성 | PM 에이전트 |
