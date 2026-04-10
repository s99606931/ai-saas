# MTU-N113: KEDA 이벤트 기반 오토스케일 완성

> 버전: 1.0.0 | 작성일: 2026-04-10 | 작성자: PM Lead

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0.0 | 2026-04-10 | 최초 작성 | PM Lead |

## Executive Summary

| 관점 | 내용 |
|------|------|
| 비즈니스 | KEDA HTTP Add-on, Prometheus 메트릭, Cron 스케줄 기반 오토스케일로 CSAP 부하 분산 자동 충족 |
| 기술 | 기존 6개 ScaledObject에 HTTP/Prometheus/Cron 스케일러 추가, 제로 스케일 정책 구현 |
| 보안 | TriggerAuthentication으로 자격증명 보안 관리, N2SF O등급 메트릭만 외부 전송 |
| 운영 | 이벤트 기반 자동 확장/축소로 비용 최적화, FinOps VPA와 연동 |

## Context Anchor

| 항목 | 내용 |
|------|------|
| WHY | 기존 CPU/메모리 기반 HPA만으로는 이벤트 드리븐 워크로드 대응 불가. HTTP 요청률, 큐 깊이 등 비즈니스 메트릭 기반 스케일링 필요 |
| WHO | 플랫폼 운영팀, 서비스 개발팀 |
| RISK | 스케일링 진동(flapping), 제로 스케일 시 콜드 스타트 지연, 메트릭 수집 지연 |
| SUCCESS | 전체 서비스 KEDA 스케일러 적용, HTTP 요청 기반 스케일링 동작 검증, Prometheus 커스텀 메트릭 스케일링 동작 검증 |
| SCOPE | KEDA HTTP Add-on 배포, Prometheus ScaledObject, Cron ScaledObject, TriggerAuthentication, 스케일링 정책 가이드 |

## 기능 요구사항

| ID | 요구사항 | 우선순위 | CSAP |
|----|---------|---------|------|
| FR-N113.1 | KEDA HTTP Add-on 설치 및 HTTP 요청 기반 스케일링 구성 | HIGH | D-10 |
| FR-N113.2 | Prometheus 메트릭 기반 ScaledObject 구성 (에러율, 지연시간) | HIGH | D-10 |
| FR-N113.3 | Cron 기반 스케줄 스케일링 (업무시간 사전 확장) | MED | D-10 |
| FR-N113.4 | TriggerAuthentication으로 안전한 자격증명 관리 | HIGH | D-08 |
| FR-N113.5 | ScaledObject 스케일링 정책 (안정화 윈도우, 쿨다운) | MED | D-10 |
| FR-N113.6 | 제로 스케일 정책 및 콜드 스타트 최적화 | MED | D-10 |
| FR-N113.7 | Grafana 대시보드에 KEDA 메트릭 패널 추가 | LOW | D-06 |
| FR-N113.8 | E2E 테스트: HTTP 부하 → 스케일아웃 → 쿨다운 → 스케일인 검증 | HIGH | D-12 |

## 비기능 요구사항

| ID | 요구사항 |
|----|---------|
| NFR-N113.1 | 스케일아웃 반응 시간 30초 이내 |
| NFR-N113.2 | 스케일링 진동 방지 (안정화 윈도우 300초) |
| NFR-N113.3 | TriggerAuthentication 시크릿 하드코딩 금지 |

## 추적성 매트릭스

| FR | Design | 구현 파일 | 테스트 | CSAP |
|----|--------|----------|--------|------|
| FR-N113.1 | DS-N113.1 | infra/keda/http-add-on/ | T-N113.1 | D-10 |
| FR-N113.2 | DS-N113.2 | infra/keda/scaled-objects/prometheus-*.yaml | T-N113.2 | D-10 |
| FR-N113.3 | DS-N113.3 | infra/keda/scaled-objects/cron-*.yaml | T-N113.3 | D-10 |
| FR-N113.4 | DS-N113.4 | infra/keda/trigger-auth/ | T-N113.4 | D-08 |
| FR-N113.5 | DS-N113.5 | infra/keda/scaling-policies/ | T-N113.5 | D-10 |
| FR-N113.6 | DS-N113.6 | infra/keda/idle-replicas/ | T-N113.6 | D-10 |
| FR-N113.7 | DS-N113.7 | infra/monitoring/dashboards/keda-*.json | T-N113.7 | D-06 |
| FR-N113.8 | DS-N113.8 | tests/e2e/keda-autoscale.test.sh | T-N113.8 | D-12 |

## 산출물 목록

| 산출물 | 경로 | 형식 |
|--------|------|------|
| Plan 문서 | docs/01-plan/mtus/MTU-N113-keda-event-autoscale.plan.md | Markdown |
| Design 문서 | docs/02-design/mtus/MTU-N113-keda-event-autoscale.design.md | Markdown |
| HTTP Add-on 배포 매니페스트 | infra/keda/http-add-on/ | YAML |
| Prometheus ScaledObject | infra/keda/scaled-objects/prometheus-*.yaml | YAML |
| Cron ScaledObject | infra/keda/scaled-objects/cron-*.yaml | YAML |
| TriggerAuthentication | infra/keda/trigger-auth/ | YAML |
| 스케일링 정책 | infra/keda/scaling-policies/ | YAML |
| Grafana 대시보드 | infra/monitoring/dashboards/keda-autoscale.json | JSON |
| E2E 테스트 | tests/e2e/keda-autoscale.test.sh | Shell |
| 분석 보고서 | docs/03-analysis/MTU-N113.analysis.md | Markdown |
| 완료 보고서 | docs/04-report/MTU-N113.report.md | Markdown |
