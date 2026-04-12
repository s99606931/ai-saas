# SVC-AI-ADV-R88 — 민원 의도 계층 분류기

> v1.0.0 | 2026-04-12 | PM Lead (5차 세션)

## Executive Summary
| 관점 | 목표 | 지표 |
|---|---|---|
| 비즈니스 | 300+ 소분류 자동 라우팅 | 정확도 ≥ 85% |
| 기술 | 대→중→소 계층 분류 + 신뢰도 | p95 < 5ms |
| 보안 | PII 마스킹 | N2SF N-05 |
| 규정 | 분류 감사 | CSAP D-06 |

## Context Anchor
- **WHY**: 기존 `citizen-request-classifier.ts`는 단일 레벨 분류. 실제 공공 민원은 대(생활민원)→중(주차)→소(주차위반 이의) 계층이 필요.
- **WHO**: 민원 접수 창구, 챗봇, 라우팅 엔진
- **RISK**: 키워드 누락, 편향
- **SUCCESS**: top-1 정확도 85%↑, unknown 비율 ≤ 5%
- **SCOPE**: IN — 계층 분류체계 등록/점수 계산/top-k / OUT — 학습형 모델

## FR
| FR | 제목 | 산출물 |
|---|---|---|
| FR-R88.1 | 계층 분류체계(Taxonomy) 등록 | petition-intent-hierarchy-classifier.ts |
| FR-R88.2 | 텍스트 점수 계산 (대·중·소 키워드 가중치) | 동일 |
| FR-R88.3 | 3단계 상위 path 반환 + 신뢰도 | 동일 |
| FR-R88.4 | unknown 처리 (임계값 미달) | 동일 |
| FR-R88.5 | getAuditLog + CLASSIFY/UNKNOWN | 동일 |

## 추적성
| FR | 산출물 | 테스트 | CSAP |
|---|---|---|---|
| R88.1~4 | petition-intent-hierarchy-classifier.ts | petition-intent-hierarchy-classifier.test.ts | - |
| R88.5 | 동일 | 동일 | D-06 |
