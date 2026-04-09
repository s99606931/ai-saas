# MTU-N24: 마이크로서비스 통합 관측가능성(Observability) 플랫폼 — Plan

> **버전**: 1.0.0 | **작성일**: 2026-04-08 | **작성자**: PM Lead
> **복잡도**: HIGH | **의존**: MTU-N21(k3s), MTU-N22(DevOps 파이프라인), MTU-I4(OpenTelemetry)

---

## Executive Summary (4관점)

| 관점 | 내용 |
|------|------|
| 비즈니스 | 마이크로서비스 간 데이터 통신·SQL·트래픽 전 영역을 단일 플랫폼에서 가시화하여 장애 MTTR 80% 단축 |
| 기술 | LGTM 스택(Loki+Grafana+Tempo+Mimir) + OpenTelemetry Operator + DB Exporter로 완전한 관측가능성 구현 |
| 보안 | CSAP D-06(감사로그), D-08(접근통제), D-09(암호화) 준수. PII 데이터 자동 마스킹 파이프라인 내장 |
| 운영 | Helm Chart 단일 명령으로 설치. Grafana 대시보드 즉시 사용 가능. AlertManager 알림 자동화 |

---

## Context Anchor

| 항목 | 내용 |
|------|------|
| WHY | MTU-N21에서 Prometheus/Grafana 기본 스택은 설치되었으나 로그 집계(Loki), 분산 추적(Tempo), SQL 쿼리 모니터링, 서비스 간 트래픽 분석이 부재. 개발팀 디버깅 효율 저하 |
| WHO | 개발팀(디버깅/로그 조회), DevOps 엔지니어(인프라 모니터링), DBA(SQL 성능 분석), 보안팀(이상 탐지) |
| RISK | Loki 고메모리 사용(WSL2 32GB 환경), OTel 자동계측 오버헤드(5-10%), pg_stat_statements 활성화 필요 |
| SUCCESS | 5개 핵심 기능 동작: 로그 조회, 분산 추적, SQL 슬로우쿼리 탐지, 트래픽 대시보드, 알림 수신 |
| SCOPE | WSL2 k3s 환경. PII 마스킹 파이프라인. PostgreSQL + Redis 모니터링. 외부 클라우드 연동 제외 |

---

## 기능 요구사항 (FR)

### FR-N24.1 — 로그 집계 및 조회 (Loki)
- Loki 3.x로 모든 마이크로서비스 로그 수집
- LogQL로 서비스별·레벨별·시간별 로그 조회
- 로그 보존: 30일(N2SF O등급), PII 자동 마스킹 필터
- Promtail / Vector로 k3s 파드 로그 자동 수집

### FR-N24.2 — 분산 추적 (Tempo + OpenTelemetry)
- OpenTelemetry Operator로 k8s 자동 계측 (Zero-code instrumentation)
- Tempo 2.x TraceQL로 서비스 간 요청 추적
- Grafana Explore에서 트레이스-로그 상관관계(Correlation) 조회
- 샘플링 전략: Head-based 10% + Tail-based(에러/슬로우) 100%

### FR-N24.3 — SQL 쿼리 모니터링 (PostgreSQL)
- pg_stat_statements 활성화: 상위 슬로우쿼리 TOP 20 대시보드
- PostgreSQL Exporter 0.17로 DB 메트릭(연결 수, 캐시 히트율, 트랜잭션 TPS)
- 인덱스 미사용 쿼리 자동 감지 + 알림
- CSAP D-12: SQL 쿼리 로그에 민감 데이터 마스킹

### FR-N24.4 — Redis 모니터링
- Redis Exporter 1.66으로 메트릭 수집 (메모리, 히트율, 연결수)
- Keyspace 별 TTL 모니터링
- Eviction 알림 (메모리 90% 초과)

### FR-N24.5 — 트래픽 모니터링
- kube-state-metrics + node-exporter로 파드 간 네트워크 트래픽
- Grafana 서비스 토폴로지 대시보드 (Node Graph Panel)
- API Gateway 요청 레이트·에러율·레이턴시(R.E.D. 메트릭)

### FR-N24.6 — 알림 자동화 (AlertManager)
- 슬로우쿼리 5초 초과 시 알림
- 에러율 1% 초과 시 알림
- Redis 메모리 90% 초과 시 알림
- Gitea Webhook으로 알림 수신 (외부 클라우드 제외)

---

## 비기능 요구사항 (NFR)

| ID | 항목 | 목표치 |
|----|------|--------|
| NFR-N24.1 | 메트릭 수집 주기 | 15초 |
| NFR-N24.2 | 로그 지연 | 수집 후 5초 이내 조회 가능 |
| NFR-N24.3 | 트레이스 지연 | 30초 이내 Grafana 노출 |
| NFR-N24.4 | 리소스 사용량 | 전체 모니터링 스택 ≤ 4GB RAM |
| NFR-N24.5 | 데이터 보존 | 메트릭 30일, 로그 30일, 트레이스 7일 |
| NFR-N24.6 | 가용성 | 모니터링 스택 SLA 99% (개발 환경) |

---

## 기술 스택 (2026년 4월 기준 최신)

| 컴포넌트 | 버전 | 역할 | Helm Chart |
|---------|------|------|-----------|
| Grafana | 11.x | 통합 대시보드 | grafana/grafana |
| Loki | 3.x | 로그 집계 | grafana/loki |
| Promtail | 3.x | 로그 수집 에이전트 | grafana/promtail |
| Tempo | 2.x | 분산 추적 | grafana/tempo |
| Prometheus (kube-prometheus-stack) | 3.x | 메트릭 수집 | prometheus-community/kube-prometheus-stack |
| AlertManager | 0.27 | 알림 라우팅 | (kube-prometheus-stack 포함) |
| OpenTelemetry Operator | 0.12x | k8s 자동 계측 | open-telemetry/opentelemetry-operator |
| PostgreSQL Exporter | 0.17 | PostgreSQL 메트릭 | prometheus-community/prometheus-postgres-exporter |
| Redis Exporter | 1.66 | Redis 메트릭 | prometheus-community/prometheus-redis-exporter |
| kube-state-metrics | 2.x | k8s 오브젝트 메트릭 | (kube-prometheus-stack 포함) |

---

## 인프라 요구사항 (INFR)

| ID | 항목 | 값 |
|----|------|---|
| INFR-N24.1 | 최소 RAM | 4GB (모니터링 네임스페이스) |
| INFR-N24.2 | 스토리지 | PVC 50GB (Loki 20GB + Prometheus 20GB + Tempo 10GB) |
| INFR-N24.3 | 네임스페이스 | `monitoring` (기존 활용) |
| INFR-N24.4 | 네트워크 | 서비스 간 내부 DNS 통신, 외부 접근 NodePort |
| INFR-N24.5 | k8s 버전 | 1.28+ (OTel Operator 요건) |

---

## 산출물 목록

| 산출물 | 경로 | 유형 |
|--------|------|------|
| Plan 문서 | `docs/01-plan/mtus/MTU-N24-observability-stack.plan.md` | 문서 |
| Design 문서 | `docs/02-design/mtus/MTU-N24-observability-stack.design.md` | 문서 |
| Loki Helm Values | `infra/monitoring/loki/values.yaml` | 설정 |
| Tempo Helm Values | `infra/monitoring/tempo/values.yaml` | 설정 |
| OTel Operator Values | `infra/monitoring/otel-operator/values.yaml` | 설정 |
| OTel Collector Config | `infra/monitoring/otel-collector.yaml` | 설정 |
| PostgreSQL Exporter | `infra/monitoring/postgres-exporter/values.yaml` | 설정 |
| Redis Exporter | `infra/monitoring/redis-exporter/values.yaml` | 설정 |
| SQL 대시보드 | `infra/monitoring/dashboards/sql-monitoring.yaml` | 설정 |
| 트래픽 대시보드 | `infra/monitoring/dashboards/service-traffic.yaml` | 설정 |
| 로그 대시보드 | `infra/monitoring/dashboards/log-explorer.yaml` | 설정 |
| 설치 스크립트 | `scripts/setup-observability.sh` | 스크립트 |
| 관측가능성 가이드 | `docs/08-infra/observability-guide.md` | 문서 |
| SQL 모니터링 가이드 | `docs/08-infra/sql-monitoring-guide.md` | 문서 |
| 디버깅·로그 가이드 | `docs/08-infra/debugging-log-guide.md` | 문서 |

---

## CSAP/N2SF 매핑

| FR | CSAP 항목 | 준수 방법 |
|----|-----------|---------|
| FR-N24.1 | D-06 침해사고관리 | 로그 30일 보존, 무결성 체크 |
| FR-N24.1 | D-12 개발보안 | PII 마스킹 Loki 파이프라인 |
| FR-N24.3 | D-12 SQL 보안 | 쿼리 로그 민감정보 마스킹 |
| FR-N24.5 | D-08 접근통제 | Grafana RBAC (admin/viewer 분리) |
| FR-N24.5 | D-10 네트워크 | 서비스 메시 트래픽 가시화 |

---

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0.0 | 2026-04-08 | 최초 작성 | PM Lead |
