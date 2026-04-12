# MTU-N224: PostgreSQL 데이터베이스 상세 모니터링

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0 | 2026-04-10 | 초안 작성 | PM Lead |

## Executive Summary

| 관점 | 내용 |
|------|------|
| 비즈니스 | 데이터베이스 성능 병목 사전 탐지, 쿼리 최적화 지원 |
| 기술 | postgres-exporter 메트릭 + 상세 대시보드 + 성능 알림 |
| 품질 | 쿼리 P99 < 100ms, 연결 풀 가용성 > 90%, 캐시 히트율 > 95% |
| 규제 | CSAP D-06 감사 로깅, D-09 암호화, D-12 시스템 보안 |

## Context Anchor

| 항목 | 내용 |
|------|------|
| WHY | PostgreSQL 쿼리 성능, 연결, 락, 복제, 캐시 상세 모니터링 |
| WHO | DBA, 백엔드 개발팀 |
| RISK | DB 성능 저하 시 전체 SaaS 서비스 영향 |
| SUCCESS | 상세 대시보드 + Recording Rules + 알림 규칙 |
| SCOPE | 쿼리 성능/연결 풀/락/복제/캐시/WAL |

## 기능 요구사항

| ID | 요구사항 | 검증 기준 |
|----|---------|----------|
| FR-N224.1 | PostgreSQL Recording Rules | 쿼리/연결/락/복제/캐시/WAL 메트릭 |
| FR-N224.2 | 상세 대시보드 | 6개 영역 패널 |
| FR-N224.3 | 성능 알림 규칙 | 쿼리 지연, 연결 부족, 락 대기, 복제 지연 |

## 산출물

| # | 산출물 | 경로 |
|---|--------|------|
| 1 | Recording Rules | `infra/monitoring/postgres-detailed-rules.yaml` |
| 2 | 대시보드 | `infra/monitoring/dashboards/postgres-detailed-dashboard.json` |
| 3 | 알림 규칙 | `infra/monitoring/postgres-detailed-alerts.yaml` |
