# SVC-AI-ADV-R84 — AI Decision Explainer (XAI)

> 2026-04-12 | v1.0.0 | PM Lead (9차 세션)

## Executive Summary
| 관점 | 목표 | 지표 |
|---|---|---|
| 비즈니스 | AI 결정 과정 투명 공개 → 행정 처분 신뢰성 확보 | 설명 완전성 ≥ 90% |
| 기술 | 입력→특징→가중→판정 4단계 설명 생성 + 기여도 분해 | 응답 p95 < 50ms |
| 보안 | C/S 등급 입력 차단, 설명문 PII 마스킹 | N2SF N-05 |
| 규정 | 행정기본법 제20조(자동 행정결정) 설명 의무 + 감사 | CSAP D-06 |

## Context Anchor
- **WHY**: 공공기관이 AI 기반으로 행정 결정(민원 자동 분류, 심사 추천 등)을 내릴 때 행정기본법 제20조 및 「AI 윤리기준」에 따라 결정 과정을 설명할 의무가 있다. `ai-explainability.ts`가 존재하지만 R84는 *결정 이유 서술 생성*에 특화 — 입력 특징→가중→판정→대안 4단계 구조화 설명.
- **WHO**: 시민(결정 대상), 담당 공무원, 감사원, 법무 검토
- **RISK**: 설명 왜곡, PII 노출, 오해 유발
- **SUCCESS**: 결정 사유 4단계 모두 포함, 상위 기여 특징 3개 이상 식별, 대안 시나리오 1개 이상
- **SCOPE**:
  - IN — 결정 입력(특징 맵), 가중치 매핑, 임계값, 대안 계산, 설명문 렌더링
  - OUT — 실제 ML 모델, UI

## FR
| FR | 제목 | 산출물 |
|---|---|---|
| FR-R84.1 | 결정 입력(특징 맵, 라벨, 점수) + 등급 guard | ai-decision-explainer.ts |
| FR-R84.2 | 특징별 기여도 분해 + Top-K 정렬 | ai-decision-explainer.ts |
| FR-R84.3 | 4단계 구조화 설명(입력/특징/가중/판정) 렌더링 | ai-decision-explainer.ts |
| FR-R84.4 | 대안 시나리오(what-if) 계산 + 반례 생성 | ai-decision-explainer.ts |
| FR-R84.5 | getAuditLog + 설명문 PII 마스킹 + 이벤트 | ai-decision-explainer.ts |

## 추적성
| FR | 산출물 | 테스트 | CSAP |
|---|---|---|---|
| FR-R84.1 | ai-decision-explainer.ts | ai-decision-explainer.test.ts | N-05 |
| FR-R84.2 | ai-decision-explainer.ts | ai-decision-explainer.test.ts | - |
| FR-R84.3 | ai-decision-explainer.ts | ai-decision-explainer.test.ts | - |
| FR-R84.4 | ai-decision-explainer.ts | ai-decision-explainer.test.ts | - |
| FR-R84.5 | ai-decision-explainer.ts | ai-decision-explainer.test.ts | D-06 |
