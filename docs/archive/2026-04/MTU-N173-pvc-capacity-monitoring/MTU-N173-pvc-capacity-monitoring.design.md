# MTU-N173: PVC 용량 자동 확장 모니터링 — Design

> **버전**: 1.0.0 | **작성일**: 2026-04-10 | **작성자**: PM Lead  
> **Plan 참조**: MTU-N173-pvc-capacity-monitoring.plan.md

---

## 컴포넌트 구조

```
infra/monitoring/pvc/
├── pvc-capacity-dashboard.json       (FR-N173.1)
├── pvc-alerting-rules.yaml           (FR-N173.2)
├── pvc-recording-rules.yaml          (FR-N173.3, N173.5)
└── pvc-expansion-recommender.yaml    (FR-N173.4)
```

## Design Anchor

- kubelet_volume_stats_* 메트릭 활용
- 기존 모니터링 스택에 추가 (변경 없음)

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0.0 | 2026-04-10 | 최초 작성 | PM Lead |
