# SVC-AI-ADV-R58 — AI Output Watermarking (Advanced)

> 2026-04-12 | v1.0.0 | 작성자: PM Lead

## Executive Summary
| 관점 | 목표 |
|---|---|
| 비즈니스 | AI 생성 콘텐츠 출처 추적, 허위 정보 방지 |
| 기술 | 통계적 토큰 워터마크(그린리스트) + HMAC 서명 메타 + 검증 |
| 보안 | CSAP D-06 감사, HMAC 키 관리(env) |
| 규정 | AI 기본법(2026) §23 투명성 |

## Context Anchor
- **WHY**: MTU-N443 기본 구현은 해시 지문 수준. 변조/재생성 저항과 통계적 검증 필요
- **WHO**: 생성 AI 게이트웨이, 감지 도구
- **RISK**: 그린/레드 토큰 편향 → 자연스러운 텍스트 유지 필수
- **SUCCESS**: 200토큰 이상 텍스트 검증 정확도 ≥ 95%, 오탐률 ≤ 5%
- **SCOPE**: 그린리스트 생성, 편향 샘플링 가이드, 통계 검증(z-score), HMAC 서명

## FR
| FR | 산출물 |
|---|---|
| FR-R58.1 시드 기반 그린리스트 생성 | `ai-watermark-advanced.ts::buildGreenList` |
| FR-R58.2 토큰 편향 가이드(bias) | `::biasLogits` |
| FR-R58.3 z-score 검증 | `::detect` |
| FR-R58.4 HMAC 서명/검증 | `::sign/verifySignature` |
| FR-R58.5 공격 저항 테스트 | `::assessRobustness` |
| FR-R58.6 감사 로그 | `::getAuditLog` |

## NFR
- 200토큰 검증 < 10ms
- TS strict, 테스트 커버리지 80%+

## 추적성
| FR | 산출물 | 테스트 |
|---|---|---|
| FR-R58.1~6 | ai-watermark-advanced.ts | `__tests__/ai-watermark-advanced.test.ts` |

## 변경 이력
| 1.0.0 | 2026-04-12 | 초안 |
