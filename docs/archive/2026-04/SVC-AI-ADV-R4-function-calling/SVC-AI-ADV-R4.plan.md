# SVC-AI-ADV-R4: Structured Tool Use / Function Calling

> 버전: 1.0.0 | 작성일: 2026-04-11 | 작성자: PM Lead

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0.0 | 2026-04-11 | 초안 작성 | PM Lead |

---

## Executive Summary

| 관점 | 내용 |
|------|------|
| 비즈니스 | AI가 공공기관 내부 시스템(민원조회, 통계, 문서생성)과 구조화된 인터페이스로 직접 연동, 텍스트 파싱 오류 제거 |
| 기술 | OpenAI 호환 Function Calling 인터페이스, JSON Schema 기반 도구 정의, 다중 도구 순차/병렬 호출 |
| 보안 | 도구 호출 전 권한 검증, 파라미터 Zod 검증, 결과 PII 마스킹 |
| 운영 | 기존 에이전트 도구와 호환, 새 도구 추가 시 JSON Schema만 정의 |

---

## Context Anchor

### WHY
기존 ReAct 에이전트는 LLM 응답에서 텍스트 패턴으로 도구 호출을 파싱합니다. 이 방식은 LLM의 출력 형식이 불안정할 때 파싱 실패가 발생합니다. 2026년 표준인 OpenAI 호환 Function Calling은 LLM이 구조화된 JSON으로 도구 호출을 반환하므로 정확성과 신뢰성이 높습니다.

### SUCCESS
- SC-1: OpenAI 호환 Function Calling 인터페이스 구현
- SC-2: JSON Schema 기반 도구 정의 (기존 ToolDefinition 확장)
- SC-3: 다중 도구 호출 (sequential + parallel)
- SC-4: 도구 호출 결과 검증 + 재시도 메커니즘
- SC-5: Function Calling API 엔드포인트

### SCOPE
- 포함: function-calling.ts, tool-schema.ts, ai-agent.ts 확장
- 제외: MCP 프로토콜 연동 (별도 MTU)

---

## 기능 요구사항

| ID | 요구사항 | 우선순위 | 검증 방법 |
|----|---------|---------|----------|
| FR-ADV4.1 | OpenAI 호환 Function Calling: tools 파라미터 지원, tool_choice 지원 | 필수 | 단위 테스트 |
| FR-ADV4.2 | JSON Schema 기반 도구 정의: parameters를 JSON Schema로 변환 | 필수 | 단위 테스트 |
| FR-ADV4.3 | 다중 도구 순차 호출: LLM이 여러 도구를 순차적으로 호출 | 중요 | 단위 테스트 |
| FR-ADV4.4 | 도구 호출 결과 검증 + 재시도 (최대 2회) | 중요 | 단위 테스트 |
| FR-ADV4.5 | Function Calling API (/ai/function-call) | 필수 | 통합 테스트 |

---

## 추적성 매트릭스

| FR ID | 구현 파일 | CSAP |
|-------|----------|------|
| FR-ADV4.1 | src/lib/function-calling.ts | D-12 |
| FR-ADV4.2 | src/lib/tool-schema.ts | D-12 |
| FR-ADV4.3 | src/lib/function-calling.ts | D-12 |
| FR-ADV4.4 | src/lib/function-calling.ts | D-12 |
| FR-ADV4.5 | src/handlers/ai-function.handler.ts | D-08, D-12 |
