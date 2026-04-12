# SVC-AI-ADV-R80 — AI Telemetry Replay

> 2026-04-12 | v1.0.0 | PM Lead (8차 세션)

## Executive Summary
| 관점 | 목표 | 지표 |
|---|---|---|
| 비즈니스 | AI 장애·회귀 재현 → 디버깅 + 회귀 방지 | 재현율 ≥ 95% |
| 기술 | 호출 기록 수집 + 결정적 replay + diff | replay p95 < 30ms |
| 보안 | 프롬프트/응답 등급 guard + 마스킹 | N2SF N-05 |
| 규정 | 재현 이력 감사 + 보존 정책 | CSAP D-06 |

## Context Anchor
- **WHY**: AI 응답 품질 저하/장애 발생 시 동일한 입력에 대한 원본 호출을 기록·재현하여 회귀 원인 분석, 새 모델 검증, 테스트 자동 생성에 활용해야 한다.
- **WHO**: AI 플랫폼팀, QA, 회귀 리그레션 파이프라인
- **RISK**: PII 유출, 재현 비결정성, 저장 폭증
- **SUCCESS**: 동일 입력 응답 해시 일치율 ≥ 95% (결정적 케이스), 마스킹 누락 0건
- **SCOPE**: IN — 레코드 등록/재현/비교/요약/TTL / OUT — 실제 LLM 호출, 영구 저장소

## FR
| FR | 제목 | 산출물 |
|---|---|---|
| FR-R80.1 | 호출 레코드(request/response/meta) + 등급 guard + PII 마스킹 | ai-telemetry-replayer.ts |
| FR-R80.2 | 레코드 조회(id/time range/tag 필터) + TTL evict | ai-telemetry-replayer.ts |
| FR-R80.3 | Replay 실행(사용자 제공 executor) + 결과 저장 | ai-telemetry-replayer.ts |
| FR-R80.4 | Diff 리포트(응답 해시/라벨/지연 차이) + 회귀 판정 | ai-telemetry-replayer.ts |
| FR-R80.5 | getAuditLog + 이벤트 (RECORD/REPLAY/REGRESSION/BLOCKED/EVICT) | ai-telemetry-replayer.ts |

## 추적성
| FR | 산출물 | 테스트 | CSAP |
|---|---|---|---|
| FR-R80.1 | ai-telemetry-replayer.ts | ai-telemetry-replayer.test.ts | N-05 |
| FR-R80.2 | ai-telemetry-replayer.ts | ai-telemetry-replayer.test.ts | - |
| FR-R80.3 | ai-telemetry-replayer.ts | ai-telemetry-replayer.test.ts | - |
| FR-R80.4 | ai-telemetry-replayer.ts | ai-telemetry-replayer.test.ts | - |
| FR-R80.5 | ai-telemetry-replayer.ts | ai-telemetry-replayer.test.ts | D-06 |
