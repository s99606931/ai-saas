# MTU-N101: Argo Rollouts 고급 배포 전략 -- Plan

> **MTU ID**: MTU-N101
> **Phase**: CI/CD 8라운드
> **작성일**: 2026-04-10
> **복잡도**: MED

---

## Executive Summary

| 관점 | 내용 |
|------|------|
| 비즈니스 | 배포 위험 최소화, Blue/Green + A/B 테스트 지원 |
| 기술 | Argo Rollouts + AnalysisTemplate + Prometheus 메트릭 |
| 보안 | 배포 롤백 자동화, 보안 게이트 통합 |
| 운영 | Grafana 배포 대시보드, 자동 롤백 알림 |

## Context Anchor

| 항목 | 내용 |
|------|------|
| WHY | Flagger 카나리 + Argo Rollouts B/G로 배포 전략 완성 |
| WHO | 개발자, SRE, QA 팀 |
| RISK | 복수 배포 도구 관리 복잡도 |
| SUCCESS | Blue/Green 1개+, A/B 1개+, AnalysisTemplate 3개+ |
| SCOPE | Argo Rollouts, AnalysisTemplate, 배포 전략 |

## 기능 요구사항

| ID | 요구사항 | 수용 기준 |
|----|---------|----------|
| FR-N101.1 | Argo Rollouts 설치 Helm values | CRD + Controller |
| FR-N101.2 | Blue/Green 배포 전략 정의 | Rollout YAML + Service 쌍 |
| FR-N101.3 | A/B 테스트 배포 전략 | Header 기반 트래픽 분리 |
| FR-N101.4 | AnalysisTemplate 정의 | 성공률, 지연시간, 에러율 3개 |
| FR-N101.5 | Grafana 배포 대시보드 | 실시간 배포 현황 패널 |
| FR-N101.6 | E2E 테스트 작성 | 10건+ ALL PASS |

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0.0 | 2026-04-10 | 초기 작성 | PM Agent |
