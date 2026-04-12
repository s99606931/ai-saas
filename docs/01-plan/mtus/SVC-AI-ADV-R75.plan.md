# SVC-AI-ADV-R75 — Dynamic Few-Shot Selector

> 2026-04-12 | v1.0.0 | PM Lead (7차 세션)

## Executive Summary
| 관점 | 목표 | 지표 |
|---|---|---|
| 비즈니스 | 프롬프트 품질 상승 → 응답 정확도 향상 | 정확도 +10% |
| 기술 | 입력 유사도 기반 예제 선택 | 선택 p95 < 10ms |
| 보안 | 예제 풀 등급 차단 | N2SF N-05 |
| 규정 | 선택 이력 감사 | CSAP D-06 |

## Context Anchor
- **WHY**: 고정 few-shot 예제는 질문 분포 변화에 취약. 입력과 가장 유사한 예제를 동적으로 선택하여 프롬프트의 효과성 극대화.
- **WHO**: AI 프롬프트 엔지니어, 고객 지원 봇
- **RISK**: 과적합 예제 선택, 편향, 데이터 등급 유출
- **SUCCESS**: few-shot 선택 일관성 ≥ 90%, 편향 경고 탐지
- **SCOPE**: IN — 예제 등록/유사도 검색/다양성 반영/편향 감지 / OUT — 임베딩 서버

## FR
| FR | 제목 | 산출물 |
|---|---|---|
| FR-R75.1 | 예제 풀 등록 + 등급 guard | dynamic-few-shot-selector.ts |
| FR-R75.2 | 토큰 Jaccard + 코사인 유사도 | dynamic-few-shot-selector.ts |
| FR-R75.3 | 다양성(MMR) 적용 선택 | dynamic-few-shot-selector.ts |
| FR-R75.4 | 편향 경고 + 카테고리 분포 리포트 | dynamic-few-shot-selector.ts |
| FR-R75.5 | getAuditLog + 선택 이력 | dynamic-few-shot-selector.ts |

## 추적성
| FR | 산출물 | 테스트 | CSAP |
|---|---|---|---|
| FR-R75.1 | dynamic-few-shot-selector.ts | dynamic-few-shot-selector.test.ts | N-05 |
| FR-R75.2 | dynamic-few-shot-selector.ts | dynamic-few-shot-selector.test.ts | - |
| FR-R75.3 | dynamic-few-shot-selector.ts | dynamic-few-shot-selector.test.ts | - |
| FR-R75.4 | dynamic-few-shot-selector.ts | dynamic-few-shot-selector.test.ts | - |
| FR-R75.5 | dynamic-few-shot-selector.ts | dynamic-few-shot-selector.test.ts | D-06 |
