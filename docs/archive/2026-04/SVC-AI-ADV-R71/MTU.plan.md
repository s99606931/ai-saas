# SVC-AI-ADV-R71 — Multi-Agent Collaboration Protocol

> 2026-04-12 | v1.0.0 | PM Lead (7차 세션)

## Executive Summary
| 관점 | 목표 | 지표 |
|---|---|---|
| 비즈니스 | 복잡 업무를 전문 에이전트에 자동 위임·집계 | 태스크 해결률 +15% |
| 기술 | 계약 기반 위임 프로토콜 + 결과 집계 | 메시지 손실 0% |
| 보안 | 에이전트 권한 분리 + C/S 등급 차단 | CSAP D-08 |
| 규정 | 위임/응답/집계 전수 감사 | CSAP D-06 |

## Context Anchor
- **WHY**: 기존 `multi-agent-collaboration.ts`는 내부 협업에 초점. 본 MTU는 서로 다른 에이전트 간 공식 메시지 프로토콜(제안/수락/결과/집계)을 정의하여 태스크 위임의 계약성을 강화.
- **WHO**: AI 오케스트레이션, 멀티테넌트 플랫폼
- **RISK**: 순환 위임, 응답 누락, 권한 우회
- **SUCCESS**: 순환 감지 100%, 위임 왕복 완료율 ≥ 99%
- **SCOPE**: IN — 메시지 타입/위임/응답/집계/타임아웃/순환 감지/감사 로그 / OUT — 실제 원격 전송(로컬 큐만)

## FR
| FR | 제목 | 산출물 |
|---|---|---|
| FR-R71.1 | 에이전트 등록 + 권한 contract | multi-agent-protocol.ts |
| FR-R71.2 | 태스크 위임 메시지 (propose/accept/reject) | multi-agent-protocol.ts |
| FR-R71.3 | 결과 응답 + 집계 (reduce 전략) | multi-agent-protocol.ts |
| FR-R71.4 | 순환 위임 감지 + 타임아웃 | multi-agent-protocol.ts |
| FR-R71.5 | C/S 등급 차단 + getAuditLog | multi-agent-protocol.ts |

## 추적성
| FR | 산출물 | 테스트 | CSAP |
|---|---|---|---|
| FR-R71.1 | multi-agent-protocol.ts | multi-agent-protocol.test.ts | D-08 |
| FR-R71.2 | multi-agent-protocol.ts | multi-agent-protocol.test.ts | D-06 |
| FR-R71.3 | multi-agent-protocol.ts | multi-agent-protocol.test.ts | - |
| FR-R71.4 | multi-agent-protocol.ts | multi-agent-protocol.test.ts | D-06 |
| FR-R71.5 | multi-agent-protocol.ts | multi-agent-protocol.test.ts | N-05 / D-06 |
