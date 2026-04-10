# MTU-N82: Pyroscope 연속 프로파일링 — Plan

> **MTU ID**: MTU-N82
> **Phase**: 6라운드 CI/CD·DevOps 고도화
> **작성일**: 2026-04-10

---

## Executive Summary

| 관점 | 내용 |
|------|------|
| 비즈니스 | 성능 병목 지점을 코드 라인 수준까지 식별하여 리소스 최적화 |
| 기술 | Grafana Pyroscope + eBPF 프로파일링 + Grafana 대시보드 연동 |
| 보안 | N2SF O등급 프로파일링 데이터만 수집, PII 미포함 |
| 운영 | 메트릭/로그/트레이스 + 프로파일 4대 관측 신호 통합 |

## Context Anchor

| 항목 | 내용 |
|------|------|
| WHY | 기존 3대 관측 신호(메트릭/로그/트레이스)로는 코드 수준 성능 분석 불가 |
| WHO | SRE 팀, 개발팀, 성능 최적화 담당 |
| RISK | 프로파일링 오버헤드 → eBPF 기반 저오버헤드 방식 채택 |
| SUCCESS | CPU/메모리 프로파일링 활성화, Grafana 연동, 1% 미만 오버헤드 |
| SCOPE | Pyroscope 서버 배포, eBPF 에이전트, Grafana 데이터소스 |

## 기능 요구사항

| ID | 요구사항 | 우선순위 |
|----|---------|---------|
| FR-N82.1 | Pyroscope 서버 Helm 배포 | HIGH |
| FR-N82.2 | eBPF 프로파일링 에이전트 DaemonSet | HIGH |
| FR-N82.3 | Grafana 데이터소스 연동 | HIGH |
| FR-N82.4 | 서비스별 프로파일링 대시보드 | MED |
| FR-N82.5 | 리소스 제한 및 데이터 보존 정책 | MED |
| FR-N82.6 | NetworkPolicy 설정 | HIGH |

## 산출물 목록

| # | 산출물 | 경로 |
|---|--------|------|
| 1 | Pyroscope Helm values | infra/pyroscope/values.yaml |
| 2 | Grafana 데이터소스 | infra/pyroscope/grafana-datasource.yaml |
| 3 | NetworkPolicy | infra/pyroscope/network-policy.yaml |
| 4 | 알림 규칙 | infra/pyroscope/alerting-rules.yaml |
| 5 | E2E 테스트 | tests/e2e/test-pyroscope.sh |
