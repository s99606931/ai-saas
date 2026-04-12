# SVC-AI-ADV-R130 — Cost Anomaly Detector

> 작성일: 2026-04-12 | 버전: 1.0.0 | 작성자: PM Lead
> 세션: #142 (R128~R132, 13차 PM 세션 o)

## Executive Summary

| 관점 | 내용 |
|------|------|
| 기능 | AI 비용 이상 감지 — Z-score + IQR + rate-of-change 3지표 앙상블 급증/급락 알람 |
| 품질 | 롤링 윈도우 통계, 임계값 기반 severity, false positive 억제를 위한 cool-down |
| 보안 | tenantId 마스킹, C/S 차단, 감사 로그 append-only |
| 비용 | 순수 계산 로컬 처리 |

## Context Anchor

- **WHY**: LLM API 비용은 요청량·토큰 길이·모델 선택에 따라 급격히 변동 가능하며, 이상 급증은 장애·오남용·공격 신호이므로 조기 감지가 필요
- **WHO**: 재무 운영자, 플랫폼 엔지니어, 보안 모니터링
- **RISK**: 이상 미감지로 예산 초과, 과민 탐지로 알람 피로, cool-down 미적용 시 중복 알람
- **SUCCESS**: 시계열 비용 데이터 수집 → 통계 계산 → Z-score/IQR/rate 3지표 평가 → severity 분류 → alert emit
- **SCOPE**: In — 롤링 윈도우, Z-score, IQR, 변화율, severity 분류, cool-down, 감사. Out — 예산 자동 차단(R123 Budget Manager 별도), 알림 채널 연동.

## 요구사항

- **FR-R130.1**: `record(tenantId, timestamp, cost)` — 비용 시계열 기록
- **FR-R130.2**: `computeZScore(tenantId)` — 최근 포인트 z = (x - mean) / std
- **FR-R130.3**: `computeIQR(tenantId)` — Q1/Q3/IQR 기반 outlier boundary (Q3 + 1.5·IQR)
- **FR-R130.4**: `computeRateOfChange(tenantId)` — 직전 대비 변화율
- **FR-R130.5**: `detect(tenantId)` — 3지표 통합 severity(normal/warning/critical) + reasons
- **FR-R130.6**: `onAnomaly(listener)` — critical 발생 시 알림 emit + cool-down 5분 기본
- **FR-R130.7**: `getAuditLog()` — 감지 이력 (CSAP D-06)
- **NFR-R130.1**: TypeScript strict 0 에러, 테스트 12개+
- **NFR-R130.2**: 100 tenant × 1000 포인트 200ms 이내
- **CSAP D-06**: 감사 로그 append-only
- **N2SF N-05**: C/S 등급 메타 차단

## 추적성 매트릭스

| FR ID | 구현 파일 | 테스트 | CSAP |
|-------|-----------|--------|------|
| FR-R130.1~6 | cost-anomaly-detector.ts | .test.ts | - |
| FR-R130.7 | getAuditLog() | test | D-06 |

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0.0 | 2026-04-12 | 최초 작성 | PM Lead |
