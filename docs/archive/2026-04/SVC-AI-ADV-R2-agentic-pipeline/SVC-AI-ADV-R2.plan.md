# SVC-AI-ADV-R2: Agentic AI Pipeline -- Plan-Execute + 에이전트 메모리

> 버전: 1.0.0 | 작성일: 2026-04-11 | 작성자: PM Lead

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0.0 | 2026-04-11 | 초안 작성 | PM Lead |

---

## Executive Summary

| 관점 | 내용 |
|------|------|
| 비즈니스 | 공공기관 업무의 복잡한 다단계 요청(예: "지난 분기 민원 분석 후 개선안 보고서 작성")을 AI 에이전트가 계획-실행 패턴으로 자율 처리, 단순 반복 업무 자동화율 향상 |
| 기술 | Plan-Execute 패턴(LLM이 실행 계획 수립 -> 단계별 도구 호출), Agent Memory(세션/장기 메모리), 동적 Tool Registry, Multi-Agent Orchestrator |
| 보안 | N2SF O등급 데이터만 처리, PII 마스킹 유지, 도구 실행 전 권한 검증, 에이전트 메모리 테넌트 격리 |
| 운영 | 기존 /ai/agent 확장 (하위 호환), 에이전트 실행 추적 대시보드 |

---

## Context Anchor

### WHY
2026년 AI 에이전트 패러다임은 단순 ReAct(Thought-Action-Observation)에서 Plan-Execute 패턴으로 진화했습니다. 복잡한 공공기관 업무(민원 분석->통계 생성->보고서 작성)는 여러 단계를 계획하고 순차적으로 실행해야 하며, 이전 대화 맥락을 기억하는 에이전트 메모리가 필수입니다.

### WHO
- 공공기관 민원 담당자: 복잡한 다단계 업무 자동화
- 정책 분석관: 데이터 수집->분석->보고서 작성 자동화
- 시스템 관리자: 에이전트 도구 등록/관리

### RISK
- Plan-Execute에서 잘못된 계획 수립 시 오류 전파 (완화: 각 단계 검증 게이트)
- 에이전트 메모리 용량 증가 (완화: 토큰 예산 제한 + 요약 압축)
- 도구 체인 공격 가능성 (완화: 도구별 권한 검증 + 실행 결과 검증)

### SUCCESS
- SC-1: Plan-Execute 패턴 구현 (계획 수립 -> 단계별 실행 -> 결과 검증)
- SC-2: Agent Memory (세션 메모리 + 요약 기반 장기 메모리)
- SC-3: 동적 Tool Registry (런타임 도구 등록/해제)
- SC-4: Agent Orchestrator (다중 에이전트 위임/병렬 실행)
- SC-5: 기존 /ai/agent 하위 호환 유지

### SCOPE
- 포함: agent-memory.ts, agent-planner.ts, tool-registry.ts, agent-orchestrator.ts, ai-agent.ts 확장
- 제외: 외부 MCP 서버 연동 (별도 MTU), UI 변경

---

## 기능 요구사항

| ID | 요구사항 | 우선순위 | 검증 방법 |
|----|---------|---------|----------|
| FR-ADV2.1 | Plan-Execute 패턴: LLM이 실행 계획(단계 목록) 수립 후 순차 실행 | 필수 | 단위 테스트 |
| FR-ADV2.2 | 에이전트 세션 메모리: 대화 히스토리 유지 (최대 20턴) | 필수 | 단위 테스트 |
| FR-ADV2.3 | 에이전트 장기 메모리: 세션 요약을 DB에 저장하여 맥락 유지 | 중요 | 단위 테스트 |
| FR-ADV2.4 | 동적 Tool Registry: 테넌트별 커스텀 도구 등록/해제 | 중요 | 단위 테스트 |
| FR-ADV2.5 | Agent Orchestrator: 복잡한 작업을 서브에이전트에게 위임 | 중요 | 단위 테스트 |
| FR-ADV2.6 | Plan-Execute API 엔드포인트 (기존 /ai/agent 확장) | 필수 | 통합 테스트 |

## 비기능 요구사항

| ID | 요구사항 |
|----|---------|
| NFR-1 | Plan-Execute 전체 실행시간 < 180초 (각 단계 30초 제한) |
| NFR-2 | 세션 메모리 최대 20턴 (초과 시 오래된 턴 요약 후 압축) |
| NFR-3 | N2SF O등급 데이터만 처리, 메모리에 PII 저장 금지 |
| NFR-4 | 테넌트 격리 (메모리/도구 레지스트리 모두 테넌트별 분리) |

---

## 추적성 매트릭스

| FR ID | 설계 섹션 | 구현 파일 | 테스트 | CSAP |
|-------|----------|----------|--------|------|
| FR-ADV2.1 | DESIGN §1 | src/lib/agent-planner.ts | TBD | D-12 |
| FR-ADV2.2 | DESIGN §2 | src/lib/agent-memory.ts | TBD | D-12, D-09 |
| FR-ADV2.3 | DESIGN §2 | src/lib/agent-memory.ts | TBD | D-12, D-09 |
| FR-ADV2.4 | DESIGN §3 | src/lib/tool-registry.ts | TBD | D-08, D-12 |
| FR-ADV2.5 | DESIGN §4 | src/lib/agent-orchestrator.ts | TBD | D-12 |
| FR-ADV2.6 | DESIGN §5 | src/handlers/ai-agent.handler.ts (확장) | TBD | D-08, D-12 |

---

## 산출물 목록

| 산출물 | 경로 | 유형 |
|--------|------|------|
| Plan-Execute 플래너 | src/lib/agent-planner.ts | 코드 |
| 에이전트 메모리 | src/lib/agent-memory.ts | 코드 |
| 동적 도구 레지스트리 | src/lib/tool-registry.ts | 코드 |
| 에이전트 오케스트레이터 | src/lib/agent-orchestrator.ts | 코드 |
| 에이전트 핸들러 확장 | src/handlers/ai-agent.handler.ts (확장) | 코드 |
| Design 문서 | docs/02-design/mtus/SVC-AI-ADV-R2.design.md | 문서 |
