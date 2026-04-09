# MTU-N47: Flux Drift Detection 자동 교정 — Design

> **버전**: 1.0.0 | **작성일**: 2026-04-09 | **Plan 참조**: MTU-N47.plan.md

---

## Design Anchor

| 항목 | 결정 |
|------|------|
| HelmRelease | `spec.driftDetection.mode: enabled` (자동 교정) |
| Kustomization | `spec.force: true` + 주기적 reconciliation |
| 환경 차별화 | prod: enabled(강제교정), stg: warn, dev: disabled |
| 알림 | Prometheus → AlertManager → Grafana |

---

## Drift Detection 모드

| 모드 | 동작 | 환경 |
|------|------|------|
| disabled | 탐지 안 함 | dev |
| warn | 탐지 + 이벤트/로그만 (교정 안 함) | stg |
| enabled | 탐지 + 자동 교정 (Git 상태로 복원) | prod |

---

## 아키텍처

```
[Manual kubectl edit] → [Cluster 상태 변경]
        ↓
[Flux Controller] → [Drift 감지]
        ↓                    ↓
[mode: enabled]        [mode: warn]
  → 자동 교정              → 이벤트 발생만
  → K8s Event 기록        → K8s Event 기록
        ↓                    ↓
[Prometheus]      ←    [Event Exporter]
        ↓
[AlertManager] → [Grafana Alert]
```

---

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0.0 | 2026-04-09 | 최초 작성 | PM Lead |
