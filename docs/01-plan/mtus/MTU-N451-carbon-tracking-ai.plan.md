# MTU-N451 — 탄소배출 추적 AI (Scope 1/2/3 자동 계산)

## Executive Summary

| 관점 | 내용 |
|------|------|
| 비즈니스 | 공공기관 탄소중립 의무화 대응, 연간 보고서 자동화 |
| 기술 | GHG Protocol 기반 Scope 1/2/3 산정, AI 배출 계수 추천 |
| 규제 | 2050 탄소중립 기본법, 환경부 공공부문 온실가스 목표관리제 |
| 품질 | 산정 정확도 95%+, 국가 배출계수 DB 연동 |

## Context Anchor
- **WHY**: 공공기관 탄소중립 의무화(2030 40% 감축) 대응을 위한 자동 배출량 산정
- **WHO**: 환경관리 담당자, ESG 보고서 작성자, 감사인
- **RISK**: 배출계수 오류→ 과소/과대 산정, 감사 지적
- **SUCCESS**: Scope 1/2/3 자동 분류 95%, 월별 리포트 자동 생성
- **SCOPE**: `packages/carbon-tracking/` 신규 패키지

## 기능 요구사항

- **FR-CARBON.1**: Scope 1 (직접 배출) 자동 계산 — 연료 사용량 × 배출계수
- **FR-CARBON.2**: Scope 2 (간접-전력) 자동 계산 — 전력 사용량 × 국가 계수
- **FR-CARBON.3**: Scope 3 (기타 간접) AI 추정 — 출장/구매/폐기물
- **FR-CARBON.4**: 배출계수 DB 버저닝 + 자동 업데이트
- **FR-CARBON.5**: 월별/분기별/연간 집계 + 감축 목표 대비 분석

## 비기능 요구사항
- NFR-1: 연간 50만 건 활동 데이터 처리, 응답 2초 이하
- NFR-2: 감사 추적 append-only (CSAP D-06)

## 추적성 매트릭스
| FR | 구현 | 테스트 | CSAP |
|----|------|--------|------|
| FR-CARBON.1 | carbon-tracker.ts §Scope1Calculator | test §scope1 | D-12 |
| FR-CARBON.2 | carbon-tracker.ts §Scope2Calculator | test §scope2 | D-12 |
| FR-CARBON.3 | carbon-tracker.ts §Scope3Estimator | test §scope3 | D-12 |
| FR-CARBON.4 | carbon-tracker.ts §EmissionFactorDB | test §factor | D-06 |
| FR-CARBON.5 | carbon-tracker.ts §ReportAggregator | test §report | D-06 |

## 변경 이력
| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0.0 | 2026-04-12 | 초안 | PM Lead |
