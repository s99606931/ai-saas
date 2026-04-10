# MTU-N237: Velero 백업/복원 상태 모니터링 — Design

> **문서 ID**: MTU-N237-DESIGN
> **버전**: 1.0.0 | **작성일**: 2026-04-10
> **Plan 참조**: MTU-N237-PLAN

---

## Executive Summary

| 관점 | 설계 결정 |
|------|----------|
| 비즈니스 | Velero 백업/복원 전 주기를 메트릭 기반으로 추적하여 DR 신뢰성 보장 |
| 기술 | PrometheusRule recording/alerting + Grafana 대시보드 |
| 보안 | CSAP D-10 재해복구 증거 자동 수집, 백업 무결성 모니터링 |
| 운영 | RTO/RPO SLI 시각화로 DR 역량 상시 확인 |

---

## Design Anchor

| 항목 | 선택 | 근거 |
|------|------|------|
| 메트릭 소스 | Velero 서버 `/metrics` 엔드포인트 | 기존 ServiceMonitor 활용 |
| 집계 방식 | PrometheusRule recording rules | 대시보드 쿼리 최적화 |
| 알림 라우팅 | AlertManager 기존 경로 | round22 통합 라우팅 |

---

## §3.1 백업 성능 Recording Rules

- `velero:backup:success_total` — 성공 백업 누적
- `velero:backup:failure_total` — 실패 백업 누적
- `velero:backup:partial_failure_total` — 부분 실패 누적
- `velero:backup:duration:p50/p95/p99` — 백업 소요시간 백분위수
- `velero:backup:size_bytes` — 백업 크기 추이
- `velero:backup:items_total` — 백업 항목 수

## §3.2 복원 성능 Recording Rules

- `velero:restore:success_total` / `failure_total` — 복원 결과 카운터
- `velero:restore:duration:p50/p95` — 복원 소요시간

## §3.3 스케줄 이행률

- `velero:schedule:last_success_age` — 마지막 성공 이후 경과시간
- `velero:schedule:success_ratio` — 스케줄 성공률

## §3.4 리소스 사용량

- Velero 서버 CPU/메모리 사용량

## §3.5 알림 규칙 (5개)

| 알림명 | 조건 | 심각도 |
|--------|------|--------|
| VeleroBackupFailed | 백업 실패 발생 | critical |
| VeleroBackupPartialFailure | 부분 실패 발생 | warning |
| VeleroScheduleStale | 스케줄 백업 24시간 미실행 | critical |
| VeleroRestoreFailed | 복원 실패 발생 | critical |
| VeleroBackupDurationHigh | 백업 소요시간 p95 > 30분 | warning |

## §3.6 Grafana 대시보드

패널: 백업 상태 타임라인, 소요시간 추이, 크기 추이, 복원 성능, 스케줄 이행률, 리소스 사용량

## §3.7 검증 스크립트

`scripts/verify-velero-monitoring.sh`

---

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0.0 | 2026-04-10 | 최초 작성 | PM Lead |
