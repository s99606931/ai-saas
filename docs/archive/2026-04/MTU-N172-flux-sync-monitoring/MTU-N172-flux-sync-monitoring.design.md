# MTU-N172: Flux GitOps 동기화 모니터링 — Design

> **버전**: 1.0.0 | **작성일**: 2026-04-10 | **작성자**: PM Lead  
> **Plan 참조**: MTU-N172-flux-sync-monitoring.plan.md

---

## 1. 아키텍처: Pragmatic Balance 선택

Flux 네이티브 메트릭 + Prometheus Recording Rules + Grafana 대시보드.

## 2. 컴포넌트 구조

```
infra/flux/monitoring/
├── flux-sync-dashboard.json         (FR-N172.1)
├── flux-alerting-rules.yaml         (FR-N172.2)
├── flux-recording-rules.yaml        (FR-N172.3, N172.5)
└── flux-drift-detection.yaml        (FR-N172.4)
```

## 3. 대시보드 패널 (FR-N172.1)

| 패널 | 쿼리 | 유형 |
|------|------|------|
| Kustomization 상태 | gotk_reconcile_condition | Table |
| HelmRelease 상태 | gotk_reconcile_condition{kind="HelmRelease"} | Table |
| 동기화 지연 시간 | gotk_reconcile_duration_seconds | Time series |
| 소스 갱신 현황 | gotk_resource_info | Stat |
| 에러 히스토리 | gotk_reconcile_condition{status="False"} | Time series |

## 4~7. 상세 설계: 알림, 메트릭, 드리프트 감지

- 동기화 실패 5분 이상 → critical 알림
- 소스 접근 실패 → warning 알림
- 리컨실 시간 5분 초과 → warning
- 드리프트 감지 CronJob (kubectl diff 기반)

## Design Anchor

- 기존 Flux 설정 변경 없음, monitoring/ 하위에만 신규 생성

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0.0 | 2026-04-10 | 최초 작성 | PM Lead |
