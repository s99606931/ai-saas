# MTU-N181: 애플리케이션 로그 패턴 이상 탐지 Plan

> **문서 ID**: PLAN-N181 | **버전**: 1.0 | **작성일**: 2026-04-10
> **작성자**: PM Lead | **상태**: 승인

---

## Executive Summary (4관점 테이블)

| 관점 | 내용 |
|------|------|
| 비즈니스 | 로그 기반 이상 징후 조기 발견으로 장애 대응 시간 단축 |
| 기술 | Loki 기반 로그 패턴 분석, 에러율 급증/로그 볼륨 이상 탐지 |
| 보안 | CSAP D-06 침해사고 관리, 보안 로그 이상 패턴 자동 감지 |
| 운영 | 에러 로그 급증 자동 알림, 로그 볼륨 폭증 조기 경보 |

## Context Anchor

| 항목 | 내용 |
|------|------|
| WHY | 로그 패턴 이상은 장애/보안 사고 전조, 조기 탐지 체계 필요 |
| WHO | SRE팀, 보안팀, 개발팀 |
| RISK | 로그 이상 미감지 시 장애 확대, 보안 사고 대응 지연 |
| SUCCESS | 에러율 급증 5분 내 알림, 로그 볼륨 이상 10분 내 감지 |
| SCOPE | Loki 로그 기반 에러율, 볼륨, 패턴 분석 + Grafana 대시보드 |

## 기능 요구사항

| ID | 요구사항 | 우선순위 | CSAP 매핑 |
|----|---------|---------|----------|
| FR-N181.1 | 에러 로그 비율 모니터링 (namespace/app별) | 필수 | D-06 |
| FR-N181.2 | 로그 볼륨 이상 탐지 (급증/급감) | 필수 | D-06 |
| FR-N181.3 | 보안 관련 로그 패턴 감지 (인증 실패, 권한 위반) | 필수 | D-08 |
| FR-N181.4 | 로그 패턴 이상 탐지 종합 대시보드 | 필수 | D-06 |
| FR-N181.5 | 스택트레이스/패닉 로그 자동 감지 | 권장 | D-12 |
| FR-N181.6 | N2SF 등급별 로그 볼륨 모니터링 | 권장 | N-03 |

## 산출물 목록

| 산출물 | 경로 | 형식 |
|--------|------|------|
| Loki 알림 규칙 | `infra/monitoring/log-anomaly-rules.yaml` | YAML |
| PrometheusRule | `infra/monitoring/log-metrics-rules.yaml` | YAML |
| Grafana 대시보드 | `infra/monitoring/dashboards/log-anomaly.json` | JSON |
| 검증 스크립트 | `tests/monitoring/test-log-anomaly.sh` | Shell |

## 추적성 매트릭스

| FR ID | Design | 구현 파일 | 테스트 | CSAP |
|-------|--------|----------|--------|------|
| FR-N181.1 | DS-N181.1 | log-anomaly-rules.yaml | TC-N181.1 | D-06 |
| FR-N181.2 | DS-N181.2 | log-anomaly-rules.yaml | TC-N181.2 | D-06 |
| FR-N181.3 | DS-N181.3 | log-anomaly-rules.yaml | TC-N181.3 | D-08 |
| FR-N181.4 | DS-N181.4 | log-anomaly.json | TC-N181.4 | D-06 |
| FR-N181.5 | DS-N181.5 | log-anomaly-rules.yaml | TC-N181.5 | D-12 |
| FR-N181.6 | DS-N181.6 | log-metrics-rules.yaml | TC-N181.6 | N-03 |

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0 | 2026-04-10 | 초안 작성 | PM Lead |
