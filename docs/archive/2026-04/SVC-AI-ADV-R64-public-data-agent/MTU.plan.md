# SVC-AI-ADV-R64 — AI 공공데이터 연계 에이전트

> 2026-04-12 | v1.0.0 | PM Lead (4차 세션)

## Executive Summary
| 관점 | 목표 | 지표 |
|---|---|---|
| 비즈니스 | 공공데이터포털 API 자동 수집/정제 | 10개 데이터셋 자동 |
| 기술 | 스키마 추론 + 품질 검증 + 증분 수집 | 중복률 0% |
| 보안 | 수집 데이터 O등급 유지 + API 키 환경변수 | 하드코딩 0건 |
| 규정 | 저작권/이용조건 자동 검증 | 공공누리 준수 |

## Context Anchor
- WHY: 공공데이터 활용 서비스 확산, 수작업 수집 비효율
- WHO: 데이터 엔지니어, 정책 분석가
- RISK: API 키 유출, 저작권 위반, 중복 수집 비용
- SUCCESS: 10개 이상 공공 API 자동 연계, 증분 수집 작동
- SCOPE: IN - REST 수집/스키마 추론/품질 검증/증분/중복 제거 / OUT - ETL 파이프라인 UI

## FR
| FR | 제목 | 산출물 |
|---|---|---|
| FR-R64.1 | 공공 API 자동 수집 | public-data-agent.ts |
| FR-R64.2 | 스키마 추론 + 품질 검증 | public-api-collector.ts |
| FR-R64.3 | 증분 수집 + 중복 제거 | public-data-agent.ts |
| FR-R64.4 | 환경변수 API 키 관리 | public-data-agent.ts (registerEndpoint 가드) |

## 추적성
| FR | 산출물 | CSAP |
|---|---|---|
| FR-R64.1 | public-data-agent.ts | D-06 |
| FR-R64.2 | public-api-collector.ts | D-12 |
| FR-R64.3 | public-data-agent.ts | - |
| FR-R64.4 | public-data-agent.ts | D-09 (시크릿 관리) |
