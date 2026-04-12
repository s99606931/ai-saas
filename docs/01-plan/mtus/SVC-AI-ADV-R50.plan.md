# SVC-AI-ADV-R50 — Speculative Decoding Router

> 2026-04-12 | v1.0.0 | 작성자: PM Lead

## Executive Summary
| 관점 | 목표 | 측정 |
|---|---|---|
| 비즈니스 | LLM 추론 비용 40% 절감, 응답속도 2x | 토큰당 비용, p95 지연 |
| 기술 | 작은 모델로 초안 생성→큰 모델 검증 | 채택률(acceptance rate) > 65% |
| 보안 | draft·target 모델 모두 N2SF O등급만 처리 | C/S 차단 |
| 규정 | CSAP D-12 + 감사 로그 필수 | 호출 추적성 |

## Context Anchor
- **WHY**: 공공기관 LLM 호출 폭증 → 비용·지연 압박. Speculative decoding은 작은 draft 모델이 토큰을 추측하고 target 모델이 한 번에 검증하여 throughput을 높입니다.
- **WHO**: AI 운영팀, FinOps, 응답 SLA 담당
- **RISK**:
  - 채택률 낮으면 오히려 비용 증가 → 자동 fallback
  - draft/target 모델 가족 mismatch → 토큰 분포 측정 필수
- **SUCCESS**: acceptance rate ≥ 65%, p95 지연 50% 단축, fallback 안정성 100%
- **SCOPE**:
  - 포함: draft/target 라우팅, 토큰 검증, acceptance 통계, 자동 fallback
  - 제외: 모델 학습 자체 (외부 단계)

## FR
| FR ID | 내용 | 산출물 |
|---|---|---|
| FR-R50.1 | 쿼리에 따라 draft 모델 선택 | `speculative-router.ts::selectDraft` |
| FR-R50.2 | draft 토큰 생성 → target 검증 | `speculative-router.ts::speculate` |
| FR-R50.3 | 검증 실패 토큰 거부, target 토큰 사용 | `speculative-router.ts::verify` |
| FR-R50.4 | acceptance rate < 임계값 시 fallback | `speculative-router.ts::shouldFallback` |
| FR-R50.5 | 라우팅·검증 통계 (acceptance, savings) | `speculative-router.ts::stats` |
| FR-R50.6 | 감사 로그 (모델 페어, 토큰 수, 결과) | `speculative-router.ts::audit` |

## NFR
- NFR-R50.1: throughput 2x 이상 (vs target only)
- NFR-R50.2: fallback 결정 지연 < 10ms
- NFR-R50.3: TS strict 모드 통과

## 추적성
| FR | 산출물 | 테스트 |
|---|---|---|
| FR-R50.1 | speculative-router.ts | selectDraft 테스트 |
| FR-R50.2 | speculative-router.ts | speculate 테스트 |
| FR-R50.3 | speculative-router.ts | verify 테스트 |
| FR-R50.4 | speculative-router.ts | fallback 테스트 |
| FR-R50.5 | speculative-router.ts | stats 테스트 |
| FR-R50.6 | speculative-router.ts | audit 테스트 |

## 변경 이력
| 버전 | 일자 | 내용 |
|---|---|---|
| 1.0.0 | 2026-04-12 | 초안 |
