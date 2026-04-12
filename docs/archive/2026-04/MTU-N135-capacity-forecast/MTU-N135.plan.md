# MTU-N135: 용량 예측 자동화 — Plan

> 버전: 1.0 | 작성일: 2026-04-10 | 작성자: PM Lead

## Executive Summary

| 관점 | 내용 |
|------|------|
| 비즈니스 | 리소스 용량 부족 사전 예측으로 장애 예방 + 적정 시점 증설 |
| 기술 | Prometheus 추세 기반 선형 회귀 예측 + 보고서 자동 생성 |
| 보안 | CSAP D-08 접근 통제 -- 용량 데이터 기반 적정 할당 |
| 운영 | 주간/월간 용량 예측 보고서 자동 발행 |

## Context Anchor

| 항목 | 내용 |
|------|------|
| WHY | 용량 부족 시 장애 발생 위험, 과잉 시 비용 낭비 |
| WHO | SRE 팀, 인프라 관리자 |
| RISK | 예측 정확도 (선형 모델의 한계) |
| SUCCESS | 14일/30일 후 리소스 고갈 예측 + 증설 권고 자동 생성 |
| SCOPE | 용량 예측 스크립트 + Recording Rules + 검증 테스트 |

## 기능 요구사항

| FR ID | 요구사항 | 검증 기준 |
|-------|---------|----------|
| FR-N135.1 | CPU/메모리/디스크 용량 현황 분석 | 리소스별 현재 사용률 표시 |
| FR-N135.2 | 선형 회귀 예측 Recording Rules | 14일/30일 후 예측 값 산출 |
| FR-N135.3 | 용량 고갈 예측 경고 | 30일 내 고갈 예상 시 경고 |
| FR-N135.4 | 증설 권고 자동 생성 | 시점 + 규모 + 비용 영향 |
| FR-N135.5 | 검증 테스트 | 스크립트 실행 + 예측 규칙 검증 |

## 산출물

| # | 산출물 | 경로 |
|---|--------|------|
| 1 | Plan 문서 | docs/01-plan/mtus/MTU-N135.plan.md |
| 2 | Design 문서 | docs/02-design/mtus/MTU-N135.design.md |
| 3 | 용량 예측 스크립트 | scripts/capacity-forecast.sh |
| 4 | 예측 Recording Rules | infra/monitoring/capacity-forecast-rules.yaml |
| 5 | 검증 테스트 | scripts/test-capacity-forecast.sh |

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0 | 2026-04-10 | 초기 작성 | PM Lead |
