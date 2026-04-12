# MTU-N196: 리소스 LimitRange 준수 모니터링 -- Plan

> 버전: 1.0.0 | 작성일: 2026-04-10 | 작성자: PM Lead

## Executive Summary

| 관점 | 내용 |
|------|------|
| 비즈니스 | 테넌트별 리소스 제약(LimitRange) 준수 여부 실시간 검증 |
| 기술 | kube_limitrange 메트릭 기반 LimitRange 설정 추적 및 위반 감지 |
| 보안 | CSAP D-08 접근 통제(리소스 격리), D-10 서비스 가용성 |
| 운영 | LimitRange 미설정 네임스페이스, 위반 컨테이너 자동 감지 |

## Context Anchor

| 항목 | 내용 |
|------|------|
| WHY | 멀티테넌시 환경에서 LimitRange 미설정 시 단일 Pod가 전체 노드 리소스 독점 가능 |
| WHO | SRE 팀, 테넌트 관리자 |
| RISK | noisy neighbor 문제, 리소스 고갈로 인한 OOM/스로틀링 |
| SUCCESS | 모든 테넌트 네임스페이스에 LimitRange 적용 확인, 위반 즉시 알림 |
| SCOPE | LimitRange 적용 현황 추적 + 위반 감지 알림 + 대시보드 |

## 기능 요구사항

| ID | 요구사항 | 우선순위 | CSAP |
|----|---------|---------|------|
| FR-N196.1 | LimitRange 설정 현황 recording rule | P0 | D-08 |
| FR-N196.2 | LimitRange 미설정 네임스페이스 알림 | P0 | D-08 |
| FR-N196.3 | 컨테이너 리소스 요청/제한 미설정 감지 | P0 | D-10 |
| FR-N196.4 | LimitRange 기본값 대비 실제 사용량 비교 | P1 | D-10 |
| FR-N196.5 | LimitRange 준수 현황 통합 대시보드 | P0 | D-08 |
| FR-N196.6 | E2E 검증 테스트 | P0 | D-12 |

## 산출물 목록

| # | 산출물 | 경로 |
|---|--------|------|
| 1 | LimitRange 모니터링 recording rules | infra/monitoring/limitrange-compliance-rules.yaml |
| 2 | LimitRange 준수 alerting rules | infra/monitoring/limitrange-compliance-alerts.yaml |
| 3 | Grafana 대시보드 | infra/monitoring/dashboards/limitrange-compliance-dashboard.json |
| 4 | E2E 테스트 | tests/monitoring/test-mtu-n196-limitrange-compliance.sh |

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0.0 | 2026-04-10 | 초안 작성 | PM Lead |
