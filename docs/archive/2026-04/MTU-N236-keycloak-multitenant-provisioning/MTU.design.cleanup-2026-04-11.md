# MTU-N236: Kyverno/Gatekeeper 정책 엔진 성능 모니터링 — Design

> **문서 ID**: MTU-N236-DESIGN
> **버전**: 1.0.0 | **작성일**: 2026-04-10
> **Plan 참조**: MTU-N236-PLAN

---

## Executive Summary

| 관점 | 설계 결정 |
|------|----------|
| 비즈니스 | Kyverno + Gatekeeper 이중 정책 엔진 통합 모니터링으로 Admission 병목 가시성 확보 |
| 기술 | PrometheusRule 기반 recording/alerting 규칙 + Grafana JSON 대시보드 |
| 보안 | 정책 엔진 가용성 모니터링 = CSAP D-08 접근통제 인프라 안정성 보장 |
| 운영 | p99 응답시간 기반 SLI/SLO + 자동 알림으로 5분 내 장애 감지 |

---

## Design Anchor

| 항목 | 선택 | 근거 |
|------|------|------|
| 메트릭 수집 | Prometheus ServiceMonitor (기존 kube-prometheus-stack) | 추가 인프라 불필요, 기존 수집 파이프라인 활용 |
| Recording Rules | PrometheusRule CRD | 사전 집계로 대시보드 쿼리 성능 향상 |
| 알림 채널 | AlertManager 기존 경로 | round22 통합 알림 라우팅 활용 |
| 대시보드 | Grafana JSON ConfigMap | GitOps 관리, 버전 추적 가능 |

---

## §3.1 Kyverno 성능 Recording Rules

**메트릭 소스**: Kyverno 컨트롤러가 노출하는 `/metrics` 엔드포인트
- `kyverno_admission_review_duration_seconds` — Admission 리뷰 소요시간
- `kyverno_policy_results_total` — 정책 평가 결과 (pass/fail/warn/error)
- `kyverno_policy_execution_duration_seconds` — 정책 실행 소요시간
- `kyverno_controller_reconcile_total` — 컨트롤러 재조정 횟수

**Recording Rules**:
- `kyverno:admission_review:p50` — p50 응답시간 (5분 윈도우)
- `kyverno:admission_review:p95` — p95 응답시간
- `kyverno:admission_review:p99` — p99 응답시간
- `kyverno:policy_results:rate5m` — 정책 결과별 초당 비율
- `kyverno:policy_error:ratio` — 오류 비율
- `kyverno:resource:usage` — CPU/메모리 사용량

---

## §3.2 Gatekeeper 성능 Recording Rules

**메트릭 소스**: Gatekeeper 컨트롤러 `/metrics`
- `gatekeeper_validation_request_duration_seconds` — Webhook 검증 소요시간
- `gatekeeper_violations` — 위반 건수 (constraint별)
- `gatekeeper_audit_duration_seconds` — Audit 소요시간
- `gatekeeper_audit_last_run_end_time` — 마지막 Audit 완료 시각

**Recording Rules**:
- `gatekeeper:validation:p50/p95/p99` — Webhook 응답시간 백분위수
- `gatekeeper:violations:by_constraint` — 제약조건별 위반 건수
- `gatekeeper:audit:duration` — Audit 소요시간 추이
- `gatekeeper:audit:staleness` — 마지막 Audit 이후 경과 시간

---

## §3.3 리소스 사용량 메트릭

- Kyverno 파드 CPU/메모리 (container_cpu_usage_seconds_total, container_memory_working_set_bytes)
- Gatekeeper 파드 CPU/메모리
- 리소스 요청 대비 실사용 비율

---

## §3.4 Policy Reporter 성능 메트릭

- `policy_reporter_send_duration_seconds` — 보고 전송 소요시간
- `policy_reporter_queue_size` — 보고 대기 큐 크기
- Policy Reporter 파드 리소스 사용량

---

## §3.5 알림 규칙 (5개)

| 알림명 | 조건 | 심각도 |
|--------|------|--------|
| KyvernoAdmissionLatencyHigh | p99 > 2초 (5분 지속) | warning |
| KyvernoAdmissionLatencyCritical | p99 > 5초 (3분 지속) | critical |
| GatekeeperValidationLatencyHigh | p99 > 3초 (5분 지속) | warning |
| GatekeeperAuditStale | 마지막 Audit 30분 초과 | warning |
| PolicyEngineErrorRateHigh | 오류율 > 5% (5분 지속) | critical |

---

## §3.6 Grafana 대시보드

**대시보드명**: Policy Engine Performance
**패널 구성**:
1. Kyverno Admission 응답시간 (p50/p95/p99 시계열)
2. Kyverno 정책 결과 분포 (pass/fail/warn/error 누적 그래프)
3. Gatekeeper Validation 응답시간 (p50/p95/p99)
4. Gatekeeper 위반 건수 (제약조건별 히트맵)
5. Gatekeeper Audit 소요시간 추이
6. 정책 엔진 리소스 사용량 (CPU/메모리 게이지)
7. Policy Reporter 큐 크기 및 전송 지연
8. 통합 오류율 (Kyverno + Gatekeeper)

---

## §3.7 검증 스크립트

`scripts/verify-policy-engine-monitoring.sh`:
- recording rule 존재 확인 (kubectl get prometheusrule)
- alerting rule 존재 확인
- Grafana 대시보드 ConfigMap 확인
- YAML 구문 검증
- 결과 요약 출력

---

## 산출물 목록

| 산출물 | 경로 |
|--------|------|
| Kyverno 성능 Recording Rules | infra/monitoring/kyverno-performance-rules.yaml |
| Gatekeeper 성능 Recording Rules | infra/monitoring/gatekeeper-performance-rules.yaml |
| Policy Reporter 성능 Rules | infra/monitoring/policy-reporter-performance-rules.yaml |
| 통합 알림 규칙 | infra/monitoring/policy-engine-performance-alerts.yaml |
| Grafana 대시보드 | infra/monitoring/dashboards/policy-engine-performance.json |
| 검증 스크립트 | scripts/verify-policy-engine-monitoring.sh |

---

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0.0 | 2026-04-10 | 최초 작성 | PM Lead |
