# SVC-AI-ADV-R126 — AI Usage Forecaster

> 작성일: 2026-04-12 | 버전: 1.0.0 | 작성자: PM Lead
> 원 요청 번호: R126

## Executive Summary

| 관점 | 내용 |
|------|------|
| 기능 | AI 사용량 시계열 예측 — 용량 계획용. 단순 지수평활(Holt) + 신뢰구간 |
| 품질 | 일/주간 시계열, MAPE 평가, 추세·평준화 분리 |
| 보안 | C/S 등급 사용자별 데이터 차단, 집계값만 활용 |
| 비용 | 결정적 알고리즘, 외부 의존 없음 |

## Context Anchor

- **WHY**: 토큰/비용 급증 추세 사전 파악 → 예산/한도 자동 조정. 정형 모델(Holt) 단순·해석 가능
- **WHO**: 운영팀 용량 계획, 비용 관리자
- **RISK**: 예측 부정확 → 신뢰구간(±sigma) 동시 제공
- **SUCCESS**: addPoint(t, v) → forecast(steps) → ForecastResult { points[], mape, range }
- **SCOPE**: In — Holt 지수평활 예측. Out — Prophet/ARIMA 등 고급 통계

## 요구사항

- **FR-R126.1**: 시계열 데이터 포인트 추가 (timestamp, value)
- **FR-R126.2**: Holt 지수평활 (level + trend) — 파라미터 alpha/beta
- **FR-R126.3**: N-step 예측 — `forecast(steps)`
- **FR-R126.4**: 학습 데이터에 대한 MAPE(Mean Absolute Percentage Error) 계산
- **FR-R126.5**: 예측치 ± sigma 신뢰구간(95%) 부착
- **FR-R126.6**: 최소 데이터 포인트 검증 (3개 미만 시 throw)
- **FR-R126.7**: 알파/베타 자동 fit (격자 탐색 0.1~0.9 step 0.1, MAPE 최소화)
- **FR-R126.8**: N2SF C/S 등급 차단 (addPoint grade)
- **FR-R126.9**: `getAuditLog()`
- **NFR-R126.1**: TypeScript strict 0, 테스트 80%+

## 추적성 매트릭스

| FR ID | 구현 | 테스트 | CSAP |
|-------|------|--------|------|
| FR-R126.1~7 | ai-usage-forecaster.ts | .test.ts | D-06 |
| FR-R126.8 | grade guard | test | N2SF N-05 |
| FR-R126.9 | auditLog | test | D-06 |
