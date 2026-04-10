# MTU-N189: Pod 리소스 제한 위반 모니터링 — Plan

> 버전: 1.0.0 | 작성일: 2026-04-10 | 작성자: PM Lead

## Executive Summary

| 관점 | 내용 |
|------|------|
| 비즈니스 | OOMKilled, CPU Throttling으로 인한 서비스 장애 사전 감지 |
| 기술 | Pod/컨테이너 레벨 리소스 사용률 vs 제한 비교 모니터링 |
| 보안 | CSAP D-10 서비스 가용성, D-12 리소스 관리 |
| 운영 | 리소스 제한 위반 자동 감지, OOMKilled 재발 방지 |

## Context Anchor

| 항목 | 내용 |
|------|------|
| WHY | OOMKilled와 CPU Throttling은 가장 흔한 Pod 장애 원인이나 전용 모니터링 부재 |
| WHO | SRE 팀, 개발팀 |
| RISK | OOMKilled 반복 미감지 시 서비스 불안정, CPU Throttling으로 응답 지연 |
| SUCCESS | CPU Throttling, Memory 사용률, OOMKilled 이벤트 100% 추적 |
| SCOPE | PrometheusRule + Grafana 대시보드 + E2E 테스트 |

## 기능 요구사항

| ID | 요구사항 | 우선순위 | CSAP |
|----|---------|---------|------|
| FR-N189.1 | CPU Throttling 비율 recording rule | P0 | D-10 |
| FR-N189.2 | Memory 사용률 vs limit 비율 recording rule | P0 | D-10 |
| FR-N189.3 | OOMKilled 이벤트 추적 recording rule | P0 | D-06 |
| FR-N189.4 | CPU Throttling 과다 알림 | P0 | D-10 |
| FR-N189.5 | Memory limit 접근 알림 (90% 초과) | P0 | D-10 |
| FR-N189.6 | OOMKilled 반복 알림 | P0 | D-06 |
| FR-N189.7 | 리소스 제한 위반 통합 대시보드 | P0 | D-10 |
| FR-N189.8 | E2E 테스트 | P0 | D-12 |

## 산출물 목록

| # | 산출물 | 경로 |
|---|--------|------|
| 1 | PrometheusRule | infra/monitoring/pod-resource-limit-rules.yaml |
| 2 | Grafana 대시보드 | infra/monitoring/dashboards/pod-resource-limit.json |
| 3 | E2E 테스트 | tests/monitoring/test-mtu-n189-pod-resource-limit.sh |

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0.0 | 2026-04-10 | 초안 작성 | PM Lead |
