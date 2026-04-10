# MTU-N221: Harbor 레지스트리 성능 모니터링

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0 | 2026-04-10 | 초안 작성 | PM Lead |

## Executive Summary

| 관점 | 내용 |
|------|------|
| 비즈니스 | 컨테이너 레지스트리 성능/가용성 모니터링으로 배포 파이프라인 안정화 |
| 기술 | Harbor 메트릭 수집 + Grafana 대시보드 + 성능 알림 |
| 품질 | 이미지 Push/Pull 지연 < 10초, 스토리지 사용률 알림, API 가용성 99.9% |
| 규제 | CSAP D-12 시스템 개발 보안, D-08 접근통제 |

## Context Anchor

| 항목 | 내용 |
|------|------|
| WHY | Harbor 레지스트리 성능 병목 조기 탐지 및 스토리지 관리 |
| WHO | DevOps 팀, 인프라 운영팀 |
| RISK | 레지스트리 장애 시 전체 배포 파이프라인 중단 |
| SUCCESS | 성능 대시보드 + Recording Rules + 알림 규칙 |
| SCOPE | Harbor API/스토리지/복제/GC 성능 모니터링 |

## 기능 요구사항

| ID | 요구사항 | 검증 기준 |
|----|---------|----------|
| FR-N221.1 | Harbor Recording Rules | API 지연, Push/Pull 성능, 스토리지, 복제 메트릭 |
| FR-N221.2 | 성능 대시보드 | API 상태/이미지 작업/스토리지/복제/GC 패널 |
| FR-N221.3 | 성능 알림 규칙 | 지연 이상, 스토리지 부족, 복제 실패, GC 지연 |

## 산출물

| # | 산출물 | 경로 |
|---|--------|------|
| 1 | Recording Rules | `infra/monitoring/harbor-performance-rules.yaml` |
| 2 | 성능 대시보드 | `infra/monitoring/dashboards/harbor-performance-dashboard.json` |
| 3 | 알림 규칙 | `infra/monitoring/harbor-performance-alerts.yaml` |
