# SVC-AI-ADV-R67 — LLM Distributed Trace

> 2026-04-12 | v1.0.0 | PM Lead (4차 세션)

## Executive Summary
| 관점 | 목표 | 지표 |
|---|---|---|
| 비즈니스 | AI 호출 전 구간 가시성 확보 | 장애 원인 분석 시간 70% 단축 |
| 기술 | OpenTelemetry 호환 span 생성 + 레이턴시 분해 + 병목 분석 | p95 트레이스 수집 지연 < 100ms |
| 보안 | 프롬프트/응답 본문 O등급 이외 저장 금지 | N2SF N-05 |
| 규정 | 모든 트레이스 audit 연동 | 100% |

## Context Anchor
- **WHY**: LLM 호출은 retriever/reranker/tool/model 다단계 구성이라 실패 지점 파악이 어렵고, 표준 분산 추적이 필요함.
- **WHO**: SRE, AI 엔지니어, 감리
- **RISK**: 본문 저장으로 인한 민감정보 유출, 과도한 span 생성에 의한 비용 폭증
- **SUCCESS**: 10개 단계 분해, 병목 자동 식별, OpenTelemetry 스키마 호환
- **SCOPE**: IN — span 생성/중첩/속성/레이턴시/내보내기 훅 / OUT — OTLP 네트워크 전송 (훅만 제공)

## FR
| FR | 제목 | 산출물 |
|---|---|---|
| FR-R67.1 | Span 생성/중첩/종료 (OpenTelemetry 호환 속성) | llm-distributed-trace.ts |
| FR-R67.2 | 레이턴시 분해 (retriever/rerank/model/tool) | llm-distributed-trace.ts |
| FR-R67.3 | 병목 자동 분석 (top-k 느린 span) | llm-distributed-trace.ts |
| FR-R67.4 | 본문 등급 guard + 샘플링 | llm-distributed-trace.ts |
| FR-R67.5 | getAuditLog + 익스포트 훅 | llm-distributed-trace.ts |

## 추적성
| FR | 산출물 | 테스트 | CSAP |
|---|---|---|---|
| FR-R67.1 | llm-distributed-trace.ts | llm-distributed-trace.test.ts | D-06 |
| FR-R67.2 | llm-distributed-trace.ts | llm-distributed-trace.test.ts | - |
| FR-R67.3 | llm-distributed-trace.ts | llm-distributed-trace.test.ts | - |
| FR-R67.4 | llm-distributed-trace.ts | llm-distributed-trace.test.ts | D-09 / N-05 |
| FR-R67.5 | llm-distributed-trace.ts | llm-distributed-trace.test.ts | D-06 |
