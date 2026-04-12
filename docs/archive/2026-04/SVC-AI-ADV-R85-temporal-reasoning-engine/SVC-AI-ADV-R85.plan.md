# SVC-AI-ADV-R85 — Temporal Reasoning Engine

> 2026-04-12 | v1.0.0 | PM Lead (9차 세션)

## Executive Summary
| 관점 | 목표 | 지표 |
|---|---|---|
| 비즈니스 | 시간/기간/순서 질의 정확 처리 → 민원 자동 응답 정확도 향상 | 정답률 ≥ 90% (시드) |
| 기술 | 자연어 날짜 파서 + Allen 관계 + 기간 계산 | 응답 p95 < 20ms |
| 보안 | 입력 등급 guard, 시스템 시각 고정(테스트) | N2SF N-05 |
| 규정 | 법령 기한(민원처리기한 등) 계산 정확성 | 행정절차법 제19조 |

## Context Anchor
- **WHY**: 공공 SaaS의 민원 챗봇, 문서 검색 등에서 "3일 전 신청한 민원", "접수 후 14일 이내", "다음 주 월요일까지" 같은 시간 기반 질의가 빈번하다. LLM만으로는 오류가 잦아 결정적 시간 추론 엔진이 필요.
- **WHO**: 민원 챗봇, 문서 검색, 법령 기한 계산기
- **RISK**: 표준시 오류, 휴일 미반영, 월말 경계 버그
- **SUCCESS**: 한국어 시드 50개 질의 중 45개 이상 정답, Allen 관계 13종 지원, 영업일 계산
- **SCOPE**:
  - IN — 한국어 날짜 파싱(일·주·월·년 상대), Allen 관계 판정, 기간 계산, 영업일 계산
  - OUT — 휴일 테이블 외부 연동(주입), 자연어 생성

## FR
| FR | 제목 | 산출물 |
|---|---|---|
| FR-R85.1 | 한국어 상대 날짜 파싱 (어제/오늘/내일/N일 전/N주 후) | temporal-reasoning-engine.ts |
| FR-R85.2 | Allen 13종 관계(before/after/meets/overlaps/during/...) 판정 | temporal-reasoning-engine.ts |
| FR-R85.3 | 기간 계산(두 시점 사이 일/주/월 차이) + 영업일 | temporal-reasoning-engine.ts |
| FR-R85.4 | 기한 계산(시작+N영업일, 민원처리기한) + 휴일 주입 | temporal-reasoning-engine.ts |
| FR-R85.5 | getAuditLog + 이벤트(PARSE/RELATE/DEADLINE/BLOCKED) | temporal-reasoning-engine.ts |

## 추적성
| FR | 산출물 | 테스트 | CSAP |
|---|---|---|---|
| FR-R85.1 | temporal-reasoning-engine.ts | temporal-reasoning-engine.test.ts | N-05 |
| FR-R85.2 | temporal-reasoning-engine.ts | temporal-reasoning-engine.test.ts | - |
| FR-R85.3 | temporal-reasoning-engine.ts | temporal-reasoning-engine.test.ts | - |
| FR-R85.4 | temporal-reasoning-engine.ts | temporal-reasoning-engine.test.ts | - |
| FR-R85.5 | temporal-reasoning-engine.ts | temporal-reasoning-engine.test.ts | D-06 |
