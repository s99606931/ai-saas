# SVC-AI-ADV-R2 DESIGN: Agentic AI Pipeline -- Plan-Execute + 에이전트 메모리

> 버전: 1.0.0 | 작성일: 2026-04-11 | 작성자: PM Lead
> Plan 참조: docs/01-plan/mtus/SVC-AI-ADV-R2.plan.md

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0.0 | 2026-04-11 | 초안 작성 | PM Lead |

---

## 아키텍처 옵션 분석

| 옵션 | 설명 | 장점 | 단점 |
|------|------|------|------|
| A. 외부 프레임워크 | LangChain/CrewAI 도입 | 기능 풍부 | 외부 의존성, CSAP 호환 불확실 |
| **B. 순수 TypeScript** | 기존 ai-agent.ts 확장 | 무의존, CSAP 준수, 완전 제어 | 기능 직접 구현 부담 |
| C. MCP 프로토콜 기반 | MCP 서버로 도구 분리 | 확장성 극대화 | 별도 인프라 필요 |

**선택: 옵션 B (Pragmatic Balance)** -- 외부 서비스 금지 제약 준수, 기존 코드 재활용

---

## §1. Plan-Execute 플래너 (agent-planner.ts)

### 설계 원칙
- LLM이 사용자 요청을 분석하여 실행 계획(단계 목록) 수립
- 각 단계에 도구 호출 또는 LLM 추론을 할당
- 단계별 실행 후 결과 검증 -> 다음 단계 진행
- 실패 시 재계획(re-plan) 최대 1회

### Plan-Execute 흐름
```
1. 사용자 요청 수신
2. LLM: 실행 계획 수립 (단계 JSON 배열)
3. for 각 단계:
   a. 도구 호출 또는 LLM 추론 실행
   b. 결과 검증 (성공/실패)
   c. 실패 시: re-plan(남은 단계 재구성)
4. 전체 결과 종합 -> 최종 답변 생성
```

### 인터페이스
```typescript
interface PlanStep {
  stepIndex: number;
  description: string;          // 이 단계에서 할 일 설명
  tool?: string;                // 사용할 도구 (없으면 LLM 추론)
  toolParams?: Record<string, unknown>;
  dependsOn?: number[];         // 의존하는 이전 단계 인덱스
  status: 'pending' | 'running' | 'completed' | 'failed';
  result?: string;
}

interface ExecutionPlan {
  goal: string;
  steps: PlanStep[];
  reasoning: string;
}

interface PlanExecuteResult {
  answer: string;
  plan: ExecutionPlan;
  steps: PlanStep[];
  replanned: boolean;
  tokensUsed: number;
  model: string;
  executionTimeMs: number;
}
```

---

## §2. 에이전트 메모리 (agent-memory.ts)

### 설계 원칙
- 세션 메모리: 인메모리 LRU 캐시 (대화 히스토리 최대 20턴)
- 장기 메모리: DB 저장 (세션 요약 -> 다음 세션에서 활용)
- PII 마스킹: 메모리 저장 전 항상 maskPII 적용
- 테넌트 격리: 메모리 키 = tenantId + sessionId

### 세션 메모리 구조
```typescript
interface MemoryEntry {
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  tokenCount: number;
}

interface SessionMemory {
  tenantId: string;
  sessionId: string;
  entries: MemoryEntry[];
  totalTokens: number;
  maxTokens: number;          // 기본 4096
  summary?: string;            // 오래된 턴 요약
}
```

### 메모리 압축 전략
- 총 토큰이 maxTokens 초과 시:
  1. 가장 오래된 50% 턴을 LLM으로 요약 (1~2문장)
  2. 요약을 summary 필드에 저장
  3. 새 대화 시 summary를 시스템 프롬프트에 주입

### 장기 메모리
- 세션 종료 시 전체 대화 요약을 DB에 저장
- 다음 세션 시작 시 이전 N개 세션 요약을 로드
- 테넌트별 격리 (AiAgentMemory 테이블)

---

## §3. 동적 Tool Registry (tool-registry.ts)

### 설계 원칙
- 기존 TOOL_DEFINITIONS 정적 배열 -> 동적 레지스트리
- 테넌트별 커스텀 도구 등록/해제
- 내장 도구 + 테넌트 커스텀 도구 합산
- 도구 실행 전 권한 검증

### 인터페이스
```typescript
interface ToolRegistryOptions {
  tenantId: string;
}

class ToolRegistry {
  registerTool(tool: ToolDefinition, executor: ToolExecutor): void;
  unregisterTool(name: string): boolean;
  getTools(): ToolDefinition[];
  getExecutors(): Record<string, ToolExecutor>;
  hasTool(name: string): boolean;
}
```

---

## §4. Agent Orchestrator (agent-orchestrator.ts)

### 설계 원칙
- 복잡한 작업을 전문 서브에이전트에게 위임
- Orchestrator가 작업 분배 -> 결과 수집 -> 종합
- 서브에이전트 유형: researcher(검색), analyst(분석), writer(작성)
- 순차 실행 (비용 예측 가능성)

### 인터페이스
```typescript
type SubAgentRole = 'researcher' | 'analyst' | 'writer' | 'reviewer';

interface SubAgentTask {
  role: SubAgentRole;
  instruction: string;
  context?: string;        // 이전 서브에이전트 결과
  tools?: string[];        // 사용 가능한 도구 필터
}

interface OrchestratorResult {
  answer: string;
  subAgentResults: Array<{
    role: SubAgentRole;
    result: string;
    tokensUsed: number;
  }>;
  totalTokensUsed: number;
  model: string;
}
```

---

## §5. API 확장 (기존 /ai/agent 확장)

### 요청 스키마 확장
```typescript
{
  // 기존
  tenantId: string;
  grade: 'O';
  query: string;
  maxIterations?: number;
  tools?: string[];
  modelId?: string;

  // 신규
  mode?: 'react' | 'plan-execute' | 'orchestrate'; // 기본: 'react'
  sessionId?: string;        // 세션 메모리용
  enableMemory?: boolean;    // 기본: false
  subAgents?: SubAgentRole[]; // 오케스트레이터 모드용
}
```

---

## Session Guide

### 구현 순서
1. `src/lib/agent-memory.ts` -- 세션/장기 메모리
2. `src/lib/tool-registry.ts` -- 동적 도구 레지스트리
3. `src/lib/agent-planner.ts` -- Plan-Execute 패턴
4. `src/lib/agent-orchestrator.ts` -- Multi-Agent 오케스트레이터
5. `src/handlers/ai-agent.handler.ts` -- API 확장
6. 통합 테스트

### Design Anchor
- 모든 구현 파일 상단: `// Design Ref: SVC-AI-ADV-R2 DESIGN §{섹션}`
- 모든 함수: `// Plan SC: FR-ADV2.{번호}`
