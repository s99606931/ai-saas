# SVC-AI-ADV-R72 — Chain-of-Thought Verifier

> 2026-04-12 | v1.0.0 | PM Lead (7차 세션)

## Executive Summary
| 관점 | 목표 | 지표 |
|---|---|---|
| 비즈니스 | LLM 추론 오류 감소 | 논리 오류 감지율 ≥ 85% |
| 기술 | CoT 단계 파싱 + 논리 검증 | 거짓 통과율 < 5% |
| 보안 | 추론 근거 데이터 등급 확인 | N2SF N-05 |
| 규정 | 검증 이력 감사 | CSAP D-06 |

## Context Anchor
- **WHY**: LLM Chain-of-Thought 결과는 겉보기 논리적이어도 비약/모순을 포함할 수 있어 감리 근거로 위험. 각 단계에 대한 자동 검증이 필요.
- **WHO**: AI 응답 검증, 감리 보고 자동화
- **RISK**: 근거 누락, 순환 논리, 잘못된 인과관계
- **SUCCESS**: 논리 오류 탐지 85%, 거짓 통과 5% 이하
- **SCOPE**: IN — 단계 파싱/근거 추적/모순 감지/수치 일관성/결과 판정 / OUT — LLM 재호출

## FR
| FR | 제목 | 산출물 |
|---|---|---|
| FR-R72.1 | CoT 텍스트 → 단계(Steps) 파싱 | cot-verifier.ts |
| FR-R72.2 | 단계 간 근거 참조 그래프 | cot-verifier.ts |
| FR-R72.3 | 모순/순환/수치 불일치 감지 | cot-verifier.ts |
| FR-R72.4 | 등급 검증 + 결과 판정(score) | cot-verifier.ts |
| FR-R72.5 | getAuditLog + 검증 리포트 | cot-verifier.ts |

## 추적성
| FR | 산출물 | 테스트 | CSAP |
|---|---|---|---|
| FR-R72.1 | cot-verifier.ts | cot-verifier.test.ts | - |
| FR-R72.2 | cot-verifier.ts | cot-verifier.test.ts | - |
| FR-R72.3 | cot-verifier.ts | cot-verifier.test.ts | - |
| FR-R72.4 | cot-verifier.ts | cot-verifier.test.ts | N-05 |
| FR-R72.5 | cot-verifier.ts | cot-verifier.test.ts | D-06 |
