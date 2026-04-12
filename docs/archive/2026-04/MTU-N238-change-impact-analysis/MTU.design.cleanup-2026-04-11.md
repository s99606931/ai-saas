# MTU-N238: Falco 런타임 보안 이벤트 모니터링 — Design

> **문서 ID**: MTU-N238-DESIGN
> **버전**: 1.0.0 | **작성일**: 2026-04-10
> **Plan 참조**: MTU-N238-PLAN

---

## Executive Summary

| 관점 | 설계 결정 |
|------|----------|
| 비즈니스 | Falco 런타임 보안 탐지 자체의 가용성·성능 메트릭 체계 구축 |
| 기술 | falco_events + falcosidekick 메트릭 기반 recording rules + alerting |
| 보안 | CSAP D-06 침해사고 탐지 역량 SLI, D-12 시스템 보안 모니터링 |
| 운영 | 이벤트 노이즈 비율 추적으로 알림 피로도 관리 |

---

## Design Anchor

| 항목 | 선택 | 근거 |
|------|------|------|
| 메트릭 소스 | Falco /metrics + Falcosidekick /metrics | 기존 ServiceMonitor 활용 |
| 이벤트 분류 | priority 레이블 (Emergency/Alert/Critical/Error/Warning/Notice/Info/Debug) | Falco 표준 심각도 체계 |

---

## §3.1 Falco 이벤트 메트릭

- `falco:events:rate5m` — 심각도별 이벤트 발생률
- `falco:events:by_rule:rate5m` — 규칙별 트리거 빈도
- `falco:events:critical_total` — Critical 이상 누적 이벤트

## §3.2 Falcosidekick 전달 성능

- `falcosidekick:output:success_rate` — 전달 성공률
- `falcosidekick:output:duration:p95` — 전달 지연 p95
- `falcosidekick:output:error_count` — 전달 오류 카운터

## §3.3 이벤트 드롭 비율

- `falco:drop:ratio` — syscall 수집 실패 비율
- `falco:drop:total` — 누적 드롭 이벤트

## §3.4 리소스 사용량

- Falco DaemonSet CPU/메모리, Falcosidekick CPU/메모리

## §3.5 알림 규칙 (5개)

| 알림명 | 조건 | 심각도 |
|--------|------|--------|
| FalcoCriticalEventDetected | Critical+ 이벤트 발생 | critical |
| FalcoHighEventRate | 이벤트 발생률 분당 100건 초과 | warning |
| FalcoEventDropHigh | 이벤트 드롭 비율 > 1% | critical |
| FalcosidekickDeliveryFailed | 전달 실패율 > 5% | critical |
| FalcoServiceDown | Falco DaemonSet 파드 부재 | critical |

## §3.6 Grafana 대시보드

패널: 심각도별 이벤트 타임라인, 규칙별 트리거 히트맵, 드롭 비율, 전달 성능, 리소스 사용량

## §3.7 검증 스크립트

`scripts/verify-falco-monitoring.sh`

---

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0.0 | 2026-04-10 | 최초 작성 | PM Lead |
