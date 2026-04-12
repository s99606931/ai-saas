# SVC-AI-ADV-R78 — Prompt Variant Experimenter

> 2026-04-12 | v1.0.0 | PM Lead (8차 세션)

## Executive Summary
| 관점 | 목표 | 지표 |
|---|---|---|
| 비즈니스 | 프롬프트 변형 실험 → 최적 프롬프트 선정 | 품질 +8% |
| 기술 | 결정적 트래픽 분배 + 메트릭 집계 + 통계 판정 | 할당 p95 < 5ms |
| 보안 | 실험 메타 등급 guard | N2SF N-05 |
| 규정 | 실험 변경·종료 감사 | CSAP D-06, D-12 |

## Context Anchor
- **WHY**: R18 `prompt-ab-testing.ts`는 실험 정의·트래픽 분배 수준. 본 모듈은 변형 실험을 경량 러너 형태로 제공하여 여러 프롬프트 템플릿의 품질/지연/에러율을 집계·비교·판정한다(독립 컨테이너).
- **WHO**: 프롬프트 엔지니어, 플랫폼팀
- **RISK**: 실험 오염, 트래픽 편향, 통계적 유의성 미달
- **SUCCESS**: 변형별 할당 편차 ≤ 2%p, 판정 일관성 ≥ 95%
- **SCOPE**: IN — 변형 등록/결정적 할당/결과 수집/지표 집계/승자 판정 / OUT — 실제 LLM 호출, 실험 DB

## FR
| FR | 제목 | 산출물 |
|---|---|---|
| FR-R78.1 | 실험 정의(control + variants) + 트래픽 합계 검증 | prompt-variant-experimenter.ts |
| FR-R78.2 | 결정적 해시 기반 트래픽 할당(sessionId) | prompt-variant-experimenter.ts |
| FR-R78.3 | 결과 기록(품질 점수/지연/성공여부) + 변형별 집계 | prompt-variant-experimenter.ts |
| FR-R78.4 | 승자 판정(평균 차이 ≥ 0.05 + 최소 샘플) | prompt-variant-experimenter.ts |
| FR-R78.5 | getAuditLog + 이벤트 (CREATE/ASSIGN/RECORD/CONCLUDE) | prompt-variant-experimenter.ts |

## 추적성
| FR | 산출물 | 테스트 | CSAP |
|---|---|---|---|
| FR-R78.1 | prompt-variant-experimenter.ts | prompt-variant-experimenter.test.ts | D-12 |
| FR-R78.2 | prompt-variant-experimenter.ts | prompt-variant-experimenter.test.ts | - |
| FR-R78.3 | prompt-variant-experimenter.ts | prompt-variant-experimenter.test.ts | - |
| FR-R78.4 | prompt-variant-experimenter.ts | prompt-variant-experimenter.test.ts | - |
| FR-R78.5 | prompt-variant-experimenter.ts | prompt-variant-experimenter.test.ts | D-06 |
