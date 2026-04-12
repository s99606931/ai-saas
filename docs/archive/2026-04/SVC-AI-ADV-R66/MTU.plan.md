# SVC-AI-ADV-R66 — Token-level Safety Streaming

> 2026-04-12 | v1.0.0 | PM Lead (4차 세션)

## Executive Summary
| 관점 | 목표 | 지표 |
|---|---|---|
| 비즈니스 | 스트리밍 응답의 실시간 안전성 검사 | 유해 출력 차단율 99% |
| 기술 | 토큰 단위 슬라이딩 윈도우 + 패턴/분류기 검사 + 즉시 인터럽트 | p99 검사 지연 < 5ms/token |
| 보안 | PII/금지어/탈옥 신호 조기 탐지 | CSAP D-12 입력검증, N2SF N-05 |
| 규정 | 차단 이벤트 감사 로그 전수 | 100% audit |

## Context Anchor
- **WHY**: LLM 스트리밍 응답은 완료 후 검증으로는 피해 발생 후 대응이 되어 버려, 토큰 단위 실시간 가드가 필요함.
- **WHO**: AI 서비스 사용자, 보안 관리자, 감리
- **RISK**: 민감정보 노출, 탈옥(jailbreak) 성공, 오탐으로 인한 정상 응답 차단
- **SUCCESS**: 주요 위험 패턴 10개 실시간 차단, 오탐률 5% 이하
- **SCOPE**: IN — 토큰 스트림 필터, 슬라이딩 윈도우, 패턴/분류기 훅, 인터럽트 / OUT — 전용 ML 분류기 학습

## FR
| FR | 제목 | 산출물 |
|---|---|---|
| FR-R66.1 | 토큰 슬라이딩 윈도우 + 패턴 스캐너 | token-safety-streaming.ts |
| FR-R66.2 | 다중 탐지기 체인 (regex/keyword/classifier) | token-safety-streaming.ts |
| FR-R66.3 | 위반 시 즉시 인터럽트 + 안전 대체 문구 출력 | token-safety-streaming.ts |
| FR-R66.4 | 차단/허용 이벤트 감사 로그 | token-safety-streaming.ts (getAuditLog) |
| FR-R66.5 | N2SF 등급 guard (C/S 입력 차단) | token-safety-streaming.ts |

## 추적성
| FR | 산출물 | 테스트 | CSAP |
|---|---|---|---|
| FR-R66.1 | token-safety-streaming.ts | token-safety-streaming.test.ts | D-12 |
| FR-R66.2 | token-safety-streaming.ts | token-safety-streaming.test.ts | D-12 |
| FR-R66.3 | token-safety-streaming.ts | token-safety-streaming.test.ts | D-06 |
| FR-R66.4 | token-safety-streaming.ts | token-safety-streaming.test.ts | D-06 |
| FR-R66.5 | token-safety-streaming.ts | token-safety-streaming.test.ts | D-09 / N-05 |

## 비고
- vitest 80%+ 커버리지
- TypeScript strict 모드
