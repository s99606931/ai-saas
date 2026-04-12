# Plan: audit-service 라운드 1 고도화

> MTU ID: SVC-AUDIT-R1 | 작성일: 2026-04-09

## FR-AUDIT.1: 감사 이벤트 집계 API
- GET /audit/analytics — 일별/주별/월별 이벤트 수 집계
- 그룹핑: action, targetType, tenantId

## FR-AUDIT.2: Top-N 통계 API
- GET /audit/analytics/top-actors — 행위자별 상위 N명
- GET /audit/analytics/top-actions — 행위별 상위 N건

## FR-AUDIT.3: 통합 테스트

## 변경 이력
| 버전 | 일자 | 작성자 |
|------|------|--------|
| 1.0.0 | 2026-04-09 | PM |
