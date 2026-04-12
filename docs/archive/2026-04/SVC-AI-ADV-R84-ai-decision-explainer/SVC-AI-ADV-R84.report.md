# SVC-AI-ADV-R84 — 보고서

## Executive Summary
| 관점 | 목표 | 달성 |
|---|---|---|
| 비즈니스 | 행정 결정 투명성 | 4단계 구조화 서술 |
| 기술 | Top-K 기여도 + what-if | value*weight 분해, flip 탐지 |
| 보안 | PII 마스킹 | narrative 자동 마스킹 |
| 규정 | 행정기본법 제20조 | 입력/특징/판정/대안 전부 설명 |

## Key Decisions
- **기존 `ai-explainability.ts`와 분리**: 범용 XAI가 아닌 *결정 이유 서술 생성* 특화
- **결정적 알고리즘**: LLM 호출 없이 가중 곱 기반 → 재현성 100%
- **대안 계산 제한**: 최대 3개, 첫 flip 발견 시 중단 (성능)

## 테스트 19/19 통과
