# SVC-AI-ADV-R43 — AI 계약서/규정 분석

> 2026-04-12 | v1.0.0

## Executive Summary
| 관점 | 목표 |
|---|---|
| 비즈니스 | 조달/계약 검토 자동화 |
| 기술 | 위험 조항 탐지 + 법령 준수 검토 |
| 보안 | 계약서 C등급 가능 → 로컬 처리 |
| 규정 | CSAP/N2SF 체크리스트 기반 |

## Context Anchor
- WHY: 조달 계약 검토 공수 과다, 놓치기 쉬운 위험 조항
- WHO: 조달 담당, 법무팀, 감리
- RISK: 오탐/미탐, 법령 버전 관리
- SUCCESS: 위험 조항 검출률 90%+
- SCOPE: IN - 조항 분류/위험도/준수 체크리스트 / OUT - 계약 자동 작성

## FR
| FR | 산출물 |
|---|---|
| FR-R43.1 위험 조항 탐지 | procurement-contract-analyzer.ts |
| FR-R43.2 규정 준수 체크 | regulation-compliance-checker.ts |
| FR-R43.3 결과 리포트 생성 | procurement-contract-analyzer.ts |
