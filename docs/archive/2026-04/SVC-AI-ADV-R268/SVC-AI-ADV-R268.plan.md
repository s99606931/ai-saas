# SVC-AI-ADV-R268 — 공공 API SLA 예측 엔진

> 작성일: 2026-04-13 | 버전: 1.0.0 | 작성자: PM (자율 생성)

## Executive Summary

| 관점 | 내용 |
|------|------|
| 기능 | 공공 API 응답시간·가용률 시계열 기반 SLA 위반 예측 |
| 품질 | EWMA 기반 추세 분석, p95/p99 산출, 예측 정확도 검증 |
| 보안 | C/S 등급 차단, 감사 로그, CSAP D-06 |
| 비용 | 로컬 수치 연산, 외부 의존 없음 |

## Context Anchor

- **WHY**: 공공 API SLA 위반 사전 감지로 민원 증가 예방
- **WHO**: 공공기관 API 운영자, SRE
- **RISK**: 측정 부족 시 예측 불안정 → 샘플 수 검증 필수
- **SUCCESS**: 메트릭 등록 → EWMA 계산 → SLA 위반 확률 산출 → 경보
- **SCOPE**: In — 예측·경보. Out — 자동 복구.

## 요구사항

- **FR-R268.1**: API 응답 메트릭 기록 (지연·성공여부)
- **FR-R268.2**: p50/p95/p99 통계 산출
- **FR-R268.3**: EWMA 기반 다음 구간 지연 예측
- **FR-R268.4**: SLA 위반 확률 계산 및 심각도 등급
- **FR-R268.5**: N2SF guard, 감사 로그, getAuditLog()
- **NFR-R268.1**: TypeScript strict, 테스트 10개+, 커버리지 80%+

## 추적성

| FR ID | 산출물 | 테스트 |
|-------|--------|--------|
| FR-R268.1~5 | public-api-sla-predictor.ts | public-api-sla-predictor.test.ts |
