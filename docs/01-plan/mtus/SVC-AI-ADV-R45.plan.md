# SVC-AI-ADV-R45 — AI Multi-doc 요약 엔진

> 2026-04-12 | v1.0.0

## Executive Summary
| 관점 | 목표 |
|---|---|
| 비즈니스 | 방대한 공문서 신속 파악 (회의록/보고서/법령) |
| 기술 | 계층적 요약 (전체/섹션/핵심) + 교차 문서 통합 |
| 보안 | O등급 마스킹 후 처리 |
| 규정 | 요약 출처 추적 가능 (인용) |

## FR
| FR | 산출물 |
|---|---|
| FR-R45.1 단일 문서 계층 요약 | summarization-engine.ts |
| FR-R45.2 다중 문서 교차 요약 | multi-doc-summarizer.ts |
| FR-R45.3 인용/출처 추적 | multi-doc-summarizer.ts |
