# SVC-AI-ADV-R86 — AI Graph Workflow Engine (LangGraph 스타일)

> v1.0.0 | 2026-04-12 | PM Lead (5차 세션)

## Executive Summary
| 관점 | 목표 | 지표 |
|---|---|---|
| 비즈니스 | 복잡 AI 워크플로우 자동화 (민원 처리·보고서 생성) | 처리 시간 50%↓ |
| 기술 | 상태 기계 DAG + 조건 분기 + 체크포인트 | 실행 정확도 100% |
| 보안 | 감사 + 등급 guard | CSAP D-06 |
| 품질 | 싸이클 검출, 결정적 실행 | 테스트 전수 |

## Context Anchor
- **WHY**: 민원 접수 → 분류 → RAG 검색 → 초안 → 검토 → 발송 같은 복잡 AI 워크플로우는 단일 프롬프트로 처리 불가. 노드/엣지/분기/체크포인트 기반 그래프 실행기 필요.
- **WHO**: AI 민원 처리, 보고서 생성, 복합 에이전트
- **RISK**: 무한 루프, 싸이클, 상태 오염
- **SUCCESS**: 싸이클 검출 100%, 체크포인트 복원 100%
- **SCOPE**: IN — 노드 등록/엣지/조건/실행/체크포인트 / OUT — 외부 DB 영속화

## FR
| FR | 제목 | 산출물 |
|---|---|---|
| FR-R86.1 | addNode/addEdge/setEntry | ai-graph-workflow-engine.ts |
| FR-R86.2 | 조건부 엣지 (condition function) | 동일 |
| FR-R86.3 | 실행 (run + state update) | 동일 |
| FR-R86.4 | 싸이클 검출 + maxSteps 가드 | 동일 |
| FR-R86.5 | 체크포인트 저장/복원 + 감사 로그 | 동일 |

## 추적성
| FR | 산출물 | 테스트 | CSAP |
|---|---|---|---|
| R86.1~4 | ai-graph-workflow-engine.ts | ai-graph-workflow-engine.test.ts | D-12 |
| R86.5 | 동일 | 동일 | D-06 |
