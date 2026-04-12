# SVC-AI-ADV-R40 — 다국어 AI 번역 엔진

> 작성일: 2026-04-12 | PM Lead | v1.0.0

## Executive Summary

| 관점 | 목표 | 지표 |
|---|---|---|
| 비즈니스 | 외국인 민원 대응 + 국제 협력 문서 | 4개 언어 왕복 지원 |
| 기술 | 도메인 특화 용어집 + BLEU 평가 | BLEU ≥ 0.60 |
| 보안 | C/S등급 데이터 번역 금지 | 등급 검증 필수 |
| 규정 | N2SF O등급 마스킹 후 처리 | 100% 준수 |

## Context Anchor
- WHY: 외국인 민원 폭증, 국제 협력 공문 품질 번역 필요
- WHO: 민원 담당자, 정책 기획자, 국제 교류 담당
- RISK: 행정 용어 오역, 법령 조항 왜곡
- SUCCESS: 행정 용어 정확도 95%+, BLEU 0.60+
- SCOPE: IN - 한↔영/일/중 번역, 용어집 관리, 품질 평가 / OUT - 음성 번역(R39 연계)

## FR
| FR | 제목 | 산출물 |
|---|---|---|
| FR-R40.1 | 4개 언어 번역 | ai-translator.ts |
| FR-R40.2 | 도메인 용어집 관리 | terminology-manager.ts |
| FR-R40.3 | BLEU 자동 평가 | translation-evaluator.ts |
| FR-R40.4 | 등급 검증 (C/S 차단) | ai-translator.ts |

## 추적성
| FR | 산출물 | CSAP |
|---|---|---|
| FR-R40.1 | ai-translator.ts | D-12 |
| FR-R40.2 | terminology-manager.ts | - |
| FR-R40.3 | translation-evaluator.ts | - |
| FR-R40.4 | ai-translator.ts | N2SF N-05 |
