# SVC-AI-ADV-R49 — LLM-as-a-Judge 자동 품질 평가

> 2026-04-12 | v1.0.0 | 작성자: PM Lead

## Executive Summary

| 관점 | 목표 | 측정 지표 |
|---|---|---|
| 비즈니스 | 사람 평가 비용 80% 절감 | 평가 1건당 < 100원 |
| 기술 | LLM 응답 품질 자동 채점 시스템 | Cohen κ > 0.7 (인간 일치도) |
| 보안 | 평가 데이터 N2SF O등급 처리 | C/S등급 자동 차단 |
| 규정 | CSAP D-12 시스템 개발 보안 | 전수 감사 로그 |

## Context Anchor

- **WHY**: 공공기관 AI 응답의 품질을 사람이 일일이 검수하기엔 비용·시간이 과다. LLM-as-a-Judge로 자동화 필요.
- **WHO**: 행정 AI 운영자, AI 거버넌스 담당, 품질 보증 팀
- **RISK**:
  - 판정 모델 편향 → 다중 모델 앙상블로 완화
  - 자기 평가 편향(self-preference bias) → 평가 모델과 생성 모델 분리
- **SUCCESS**: 인간 평가자와의 일치도(Cohen κ) 0.7 이상, 평가 처리량 100 req/s
- **SCOPE**:
  - 포함: 정확성/관련성/일관성/안전성 4축 평가, 페어와이즈 비교, 점수 분포 분석
  - 제외: 모델 학습용 RLHF 데이터 생성(별도 R로 진행)

## FR (기능 요구사항)

| FR ID | 요구사항 | 산출물 |
|---|---|---|
| FR-R49.1 | 단일 응답 4축 평가 (정확성/관련성/일관성/안전성) | `llm-as-judge.ts::JudgeEngine.evaluate()` |
| FR-R49.2 | 페어와이즈 비교 (A vs B 어느 쪽이 더 좋은가) | `llm-as-judge.ts::JudgeEngine.compare()` |
| FR-R49.3 | 다중 판정 앙상블 (3 judges median) | `llm-as-judge.ts::JudgeEngine.ensemble()` |
| FR-R49.4 | 평가 결과 감사 로그 기록 | `llm-as-judge.ts::JudgeEngine.audit()` |
| FR-R49.5 | 자기 평가 편향 감지 (judge == generator 차단) | `llm-as-judge.ts::JudgeEngine.detectBias()` |
| FR-R49.6 | 점수 분포 통계 (mean/median/p95) | `llm-as-judge.ts::JudgeEngine.stats()` |

## NFR

| NFR ID | 비기능 요구사항 | 측정 |
|---|---|---|
| NFR-R49.1 | 평가 처리량 100 req/s | 부하 테스트 |
| NFR-R49.2 | 단일 평가 지연시간 p95 < 2s | 모니터링 |
| NFR-R49.3 | 인간 평가 일치도 Cohen κ > 0.7 | 골드셋 비교 |

## 추적성 매트릭스

| FR | 산출물 | 테스트 | CSAP |
|---|---|---|---|
| FR-R49.1 | `llm-as-judge.ts` | `evaluate` 테스트 | D-12 |
| FR-R49.2 | `llm-as-judge.ts` | `compare` 테스트 | D-12 |
| FR-R49.3 | `llm-as-judge.ts` | `ensemble` 테스트 | D-12 |
| FR-R49.4 | `llm-as-judge.ts` | `audit` 테스트 | D-06 |
| FR-R49.5 | `llm-as-judge.ts` | `detectBias` 테스트 | D-12 |
| FR-R49.6 | `llm-as-judge.ts` | `stats` 테스트 | D-12 |

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|---|---|---|---|
| 1.0.0 | 2026-04-12 | 초안 작성 | PM Lead |
