# SVC-AI-ADV-R4 DESIGN: Structured Tool Use / Function Calling

> 버전: 1.0.0 | 작성일: 2026-04-11 | 작성자: PM Lead
> Plan 참조: docs/01-plan/mtus/SVC-AI-ADV-R4.plan.md

## 아키텍처: 옵션 B (순수 TypeScript) 선택

---

## §1. Function Calling 엔진 (function-calling.ts)

### 설계 원칙
- OpenAI API 호환 tools 배열 형식
- LLM 응답에서 tool_calls 추출
- 도구 실행 -> 결과를 tool 역할 메시지로 피드백
- 최대 반복 횟수 제한 (무한 루프 방지)

### 호출 흐름
```
1. 사용자 메시지 + tools 정의 -> LLM
2. LLM 응답: tool_calls[{id, name, arguments}]
3. 각 tool_call 실행
4. 결과를 {role: "tool", tool_call_id, content} 으로 피드백
5. LLM이 최종 답변 생성 또는 추가 tool_calls
6. 반복 (최대 5회)
```

### 인터페이스
```typescript
interface FunctionCallingOptions {
  maxRounds?: number;        // 최대 호출 라운드 (기본 5)
  toolChoice?: 'auto' | 'none' | string; // 도구 선택 전략
  maxTokens?: number;
}

interface FunctionCallResult {
  answer: string;
  toolCalls: ToolCallLog[];
  tokensUsed: number;
  model: string;
  rounds: number;
}
```

---

## §2. 도구 스키마 변환 (tool-schema.ts)

기존 ToolDefinition -> OpenAI Function Schema 변환

```typescript
interface OpenAIFunctionTool {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: JSONSchema;
  };
}
```

---

## §3. API 엔드포인트

POST /ai/function-call
```json
{
  "tenantId": "uuid",
  "grade": "O",
  "messages": [{"role": "user", "content": "..."}],
  "tools": ["search_knowledge", "calculate"],
  "toolChoice": "auto",
  "modelId": "optional"
}
```

## Session Guide

### 구현 순서
1. `src/lib/tool-schema.ts` -- 스키마 변환
2. `src/lib/function-calling.ts` -- Function Calling 엔진
3. `src/handlers/ai-function.handler.ts` -- API 핸들러
4. `src/routes.ts` -- 라우트 등록
