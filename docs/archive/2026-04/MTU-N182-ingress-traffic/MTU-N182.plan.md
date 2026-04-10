# MTU-N182: Ingress/Gateway API 트래픽 모니터링 Plan

> **문서 ID**: PLAN-N182 | **버전**: 1.0 | **작성일**: 2026-04-10
> **작성자**: PM Lead | **상태**: 승인

---

## Executive Summary (4관점 테이블)

| 관점 | 내용 |
|------|------|
| 비즈니스 | API 게이트웨이/Ingress 트래픽 가시성 확보로 서비스 품질 관리 |
| 기술 | Ingress Controller 메트릭 수집, HTTP 상태 코드별 분석, 레이턴시 모니터링 |
| 보안 | CSAP D-08 접근 통제, D-13 네트워크 보안, 비정상 트래픽 탐지 |
| 운영 | 엔드포인트별 응답 시간, 에러율, RPS 자동 모니터링 |

## Context Anchor

| 항목 | 내용 |
|------|------|
| WHY | 외부 트래픽 진입점(Ingress)의 품질 모니터링은 사용자 경험의 핵심 |
| WHO | SRE팀, API 개발팀, 보안팀 |
| RISK | Ingress 장애 미감지 시 전체 서비스 접근 불가, 보안 위협 미탐지 |
| SUCCESS | HTTP 5xx 에러율 <1%, P99 레이턴시 <500ms, RPS 이상 10분 내 감지 |
| SCOPE | Ingress Controller 메트릭, HTTP 트래픽 분석, Gateway API 현황 |

## 기능 요구사항

| ID | 요구사항 | 우선순위 | CSAP 매핑 |
|----|---------|---------|----------|
| FR-N182.1 | HTTP 상태 코드별 요청 수 모니터링 (2xx/3xx/4xx/5xx) | 필수 | D-13 |
| FR-N182.2 | 요청 레이턴시 P50/P90/P99 모니터링 | 필수 | D-13 |
| FR-N182.3 | Ingress별 RPS(초당 요청 수) 모니터링 | 필수 | D-13 |
| FR-N182.4 | Ingress 트래픽 종합 대시보드 (Grafana) | 필수 | D-06 |
| FR-N182.5 | 비정상 트래픽 패턴 탐지 (DDoS 의심, 봇 트래픽) | 필수 | D-08 |
| FR-N182.6 | TLS 인증서 만료 예측 및 알림 | 권장 | D-09 |

## 산출물 목록

| 산출물 | 경로 | 형식 |
|--------|------|------|
| PrometheusRule | `infra/monitoring/ingress-traffic-rules.yaml` | YAML |
| Grafana 대시보드 | `infra/monitoring/dashboards/ingress-traffic.json` | JSON |
| 검증 스크립트 | `tests/monitoring/test-ingress-traffic.sh` | Shell |

## 추적성 매트릭스

| FR ID | Design | 구현 파일 | 테스트 | CSAP |
|-------|--------|----------|--------|------|
| FR-N182.1 | DS-N182.1 | ingress-traffic-rules.yaml | TC-N182.1 | D-13 |
| FR-N182.2 | DS-N182.2 | ingress-traffic-rules.yaml | TC-N182.2 | D-13 |
| FR-N182.3 | DS-N182.3 | ingress-traffic-rules.yaml | TC-N182.3 | D-13 |
| FR-N182.4 | DS-N182.4 | ingress-traffic.json | TC-N182.4 | D-06 |
| FR-N182.5 | DS-N182.5 | ingress-traffic-rules.yaml | TC-N182.5 | D-08 |
| FR-N182.6 | DS-N182.6 | ingress-traffic-rules.yaml | TC-N182.6 | D-09 |

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0 | 2026-04-10 | 초안 작성 | PM Lead |
