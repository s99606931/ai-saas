# SVC-AI-ADV-R42 — 프롬프트 자동 최적화

> 2026-04-12 | v1.0.0

## Executive Summary
| 관점 | 목표 |
|---|---|
| 비즈니스 | LLM 비용 30% 절감 + 정확도 향상 |
| 기술 | DSPy 패턴 메트릭 기반 최적화 (정확도/비용/레이턴시) |
| 보안 | 실험 데이터 O등급 마스킹 |
| 규정 | 최적화 결과 audit 기록 |

## Context Anchor
- WHY: 프롬프트 수동 튜닝 비효율
- WHO: AI 엔지니어, MLOps
- RISK: 메트릭 편향, 평가 데이터 누출
- SUCCESS: 비용 30%↓, 정확도 5%↑
- SCOPE: IN - few-shot 자동 선택, 명령 자동 재작성, 평가 / OUT - 모델 파인튜닝

## FR
| FR | 산출물 |
|---|---|
| FR-R42.1 프롬프트 자동 재작성 | prompt-optimizer.ts |
| FR-R42.2 few-shot 자동 선택 | dspy-compiler.ts |
| FR-R42.3 3축 메트릭 평가 | prompt-optimizer.ts |
