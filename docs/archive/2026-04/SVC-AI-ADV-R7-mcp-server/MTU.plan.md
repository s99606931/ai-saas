# SVC-AI-ADV-R7: MCP (Model Context Protocol) 서버

> 버전: 1.0.0 | 작성일: 2026-04-11 | 작성자: PM Lead

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0.0 | 2026-04-11 | 초안 작성 | PM Lead |

---

## Executive Summary

| 관점 | 내용 |
|------|------|
| 비즈니스 | Anthropic MCP 표준 기반으로 공공기관 도메인 도구를 AI에 안전하게 노출. 법령 검색, 공문서 생성, 행정 DB 조회 등 공공기관 핵심 기능을 AI 에이전트가 직접 활용 가능 |
| 기술 | MCP 2025-03-26 사양 기반 Resources + Tools + Prompts 전수 구현, JSON-RPC 2.0 전송, stdio/SSE 이중 전송 지원 |
| 보안 | N2SF O등급 데이터만 노출, 도구별 RBAC 권한 제어, 입력 검증 필수, CSAP D-08/D-12 준수 |
| 운영 | MCP Inspector로 디버깅 가능, 도구 등록/해제 동적 관리, 사용량 메트릭 수집 |

---

## Context Anchor

### WHY
MCP(Model Context Protocol)는 Anthropic이 제안한 AI 모델과 외부 도구/데이터 연동 표준 프로토콜입니다. 2026년 현재 Claude, GPT, Gemini 등 주요 LLM이 MCP를 지원하며, 공공기관 SaaS에서도 법령 검색, 공문서 양식 생성, 행정 데이터 조회 등 도메인 특화 도구를 MCP 서버로 제공하면 AI 에이전트의 활용도가 대폭 향상됩니다.

### WHO
- AI 에이전트: MCP 클라이언트로서 도구 호출
- 공공기관 개발자: MCP 도구 추가/확장
- 시스템 관리자: MCP 서버 모니터링, 도구 등록 관리

### RISK
- R1: 도구 오남용 시 민감 데이터 노출 (완화: RBAC + O등급 데이터만 노출)
- R2: 잘못된 도구 입력으로 시스템 오류 (완화: Zod 스키마 검증)
- R3: MCP 서버 과부하 (완화: 동시 호출 제한, 타임아웃)

### SUCCESS
- SC-1: MCP Resources 구현 — 법령 문서, 공문서 양식 등 리소스 노출
- SC-2: MCP Tools 구현 — 법령 검색, 공문서 생성, 행정 DB 조회
- SC-3: MCP Prompts 구현 — 공공기관 도메인 프롬프트 템플릿
- SC-4: JSON-RPC 2.0 전송 프로토콜 구현
- SC-5: 도구별 RBAC 권한 제어 (CSAP D-08)
- SC-6: 모든 도구 입력 Zod 검증 (CSAP D-12)

### SCOPE
- IN: MCP 서버 코어, Resources/Tools/Prompts 프리미티브, 공공기관 도메인 도구, RBAC
- OUT: MCP 클라이언트 구현(별도 MTU), 양방향 Sampling

---

## 기능 요구사항

| FR ID | 요구사항 | 우선순위 | 검증 방법 |
|-------|---------|---------|----------|
| FR-ADV7.1 | MCP 서버 코어 — JSON-RPC 2.0 메시지 라우팅 | P0 | 단위 테스트 |
| FR-ADV7.2 | MCP Resources — 법령 문서, 공문서 양식 리소스 제공 | P0 | 통합 테스트 |
| FR-ADV7.3 | MCP Tools — 법령 검색, 공문서 생성, 행정 DB 조회 | P0 | 도구 호출 테스트 |
| FR-ADV7.4 | MCP Prompts — 공공기관 프롬프트 템플릿 제공 | P1 | 프롬프트 호출 테스트 |
| FR-ADV7.5 | 도구별 RBAC 권한 제어 (CSAP D-08) | P0 | 보안 테스트 |
| FR-ADV7.6 | 도구 입력 Zod 스키마 검증 (CSAP D-12) | P0 | 검증 실패 테스트 |
| FR-ADV7.7 | 도구 등록/해제 동적 관리 | P1 | 관리 API 테스트 |
| FR-ADV7.8 | 도구 실행 감사 로그 (CSAP D-06) | P0 | 로그 검증 |

---

## 비기능 요구사항

| NFR ID | 요구사항 | 기준 |
|--------|---------|------|
| NFR-R7.1 | 도구 응답 시간 | < 3초 (P95) |
| NFR-R7.2 | 동시 도구 호출 | 10+ 동시 호출/테넌트 |
| NFR-R7.3 | 도구 수 | 50+ 도구 등록 가능 |

---

## 추적성 매트릭스

| FR ID | Design 섹션 | 구현 파일 | CSAP |
|-------|-----------|----------|------|
| FR-ADV7.1 | §1 MCP 코어 | mcp-server.ts | D-12 |
| FR-ADV7.2 | §2 Resources | mcp-resources.ts | D-12 |
| FR-ADV7.3 | §3 Tools | mcp-tools.ts | D-12 |
| FR-ADV7.4 | §4 Prompts | mcp-server.ts | D-12 |
| FR-ADV7.5 | §5 RBAC | mcp-server.ts | D-08 |
| FR-ADV7.6 | §6 입력 검증 | mcp-tools.ts | D-12 |
| FR-ADV7.7 | §7 동적 관리 | mcp-server.ts | D-12 |
| FR-ADV7.8 | §8 감사 로그 | mcp-server.ts | D-06 |

---

## 산출물 목록

| 산출물 | 경로 | 설명 |
|--------|------|------|
| Design 문서 | docs/02-design/mtus/SVC-AI-ADV-R7.design.md | 아키텍처 설계 |
| mcp-server.ts | platform/services/ai-service/src/lib/mcp-server.ts | MCP 서버 코어 |
| mcp-tools.ts | platform/services/ai-service/src/lib/mcp-tools.ts | 공공기관 도구 |
| mcp-resources.ts | platform/services/ai-service/src/lib/mcp-resources.ts | 리소스 프로바이더 |
