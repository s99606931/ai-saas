// ReAct 패턴 에이전트 — FR-AI26.2
// Design Ref: SVC-AI-2026 DESIGN §2
// Thought → Action → Observation → Answer 루프 (최대 10단계, 타임아웃 120초)

import { getLLMConfig, buildLLMConfig, createLLMProvider } from './llm-provider.js';
import { maskPII } from './pii-masking.js';
import type { LLMMessage } from './llm-provider.js';
import type { ToolDefinition, ToolExecutor } from './ai-tools.js';

export interface AgentStep {
  stepIndex: number;
  thought: string;
  action?: { tool: string; params: Record<string, unknown> };
  observation?: string;
  isFinal: boolean;
}

export interface AgentResult {
  answer: string;
  steps: AgentStep[];
  tokensUsed: number;
  model: string;
  iterations: number;
  timedOut: boolean;
  error?: string;
}

export interface AgentOptions {
  maxIterations?: number;
  timeoutMs?: number;
  maxTokens?: number;
  systemPromptSuffix?: string;
}

const MAX_ITERATIONS = 10;
const TIMEOUT_MS = 120_000;
const TOKEN_BUDGET = 8192;

/**
 * 도구 목록을 LLM 프롬프트용 텍스트로 변환
 */
function buildToolDescriptions(tools: ToolDefinition[]): string {
  return tools
    .map((t) => {
      const params = Object.entries(t.parameters)
        .map(([k, v]) => `  - ${k} (${v.type}${v.required ? ', 필수' : ''}): ${v.description}`)
        .join('\n');
      return `### ${t.name}\n${t.description}\n파라미터:\n${params || '  없음'}`;
    })
    .join('\n\n');
}

/**
 * LLM 응답에서 Thought / Action / Final Answer 파싱
 */
function parseAgentResponse(text: string): {
  thought: string;
  action?: { tool: string; params: Record<string, unknown> };
  isFinal: boolean;
  finalAnswer?: string;
} {
  // Final Answer 감지
  const finalMatch = /Final Answer:\s*([\s\S]+?)(?:\n\nThought:|$)/i.exec(text);
  if (finalMatch) {
    const thoughtMatch = /Thought:\s*(.+?)(?:\n|$)/i.exec(text);
    return {
      thought: thoughtMatch?.[1]?.trim() ?? '최종 답변을 생성합니다.',
      isFinal: true,
      finalAnswer: finalMatch[1]?.trim(),
    };
  }

  // Thought 추출
  const thoughtMatch = /Thought:\s*(.+?)(?:\nAction:|$)/is.exec(text);
  const thought = thoughtMatch?.[1]?.trim() ?? text.slice(0, 200);

  // Action 추출: Action: tool_name({"key": "value"})
  const actionMatch = /Action:\s*(\w+)\s*\((.+?)\)\s*(?:\n|$)/s.exec(text);
  if (actionMatch) {
    const toolName = actionMatch[1]?.trim() ?? '';
    const paramsStr = actionMatch[2]?.trim() ?? '{}';
    let params: Record<string, unknown> = {};
    try {
      params = JSON.parse(paramsStr) as Record<string, unknown>;
    } catch {
      // 단순 문자열 파라미터 처리
      params = { input: paramsStr };
    }
    return { thought, action: { tool: toolName, params }, isFinal: false };
  }

  // Action JSON 블록 형식 처리
  const actionJsonMatch = /Action:\s*```(?:json)?\s*\n?([\s\S]*?)\n?```/i.exec(text);
  if (actionJsonMatch) {
    try {
      const parsed = JSON.parse(actionJsonMatch[1] ?? '{}') as { tool?: string; params?: Record<string, unknown> };
      if (parsed.tool) {
        return { thought, action: { tool: parsed.tool, params: parsed.params ?? {} }, isFinal: false };
      }
    } catch {
      // 파싱 실패 시 무시
    }
  }

  return { thought, isFinal: false };
}

/**
 * ReAct 에이전트 실행
 * @param query 사용자 질문
 * @param tools 사용 가능한 도구 정의
 * @param executors 도구 실행기 맵
 * @param options 에이전트 옵션
 */
export async function runAgent(
  query: string,
  tools: ToolDefinition[],
  executors: Record<string, ToolExecutor>,
  options: AgentOptions = {},
  modelConfig?: { provider: string; endpoint: string; name: string; config?: unknown },
): Promise<AgentResult> {
  const { maxIterations = MAX_ITERATIONS, timeoutMs = TIMEOUT_MS, maxTokens = TOKEN_BUDGET } = options;

  const maskedQuery = maskPII(query);
  const toolDescriptions = buildToolDescriptions(tools);
  const startTime = Date.now();

  const systemPrompt = `당신은 공공기관 SaaS 플랫폼의 AI 어시스턴트입니다.
다음 도구를 사용하여 사용자 질문에 답변하세요.

## 사용 가능한 도구

${toolDescriptions}

## 응답 형식 (반드시 준수)

1단계씩 다음 형식으로 응답합니다:

Thought: [현재 상황 분석 및 다음 행동 계획]
Action: tool_name({"param1": "value1", "param2": "value2"})

최종 답변 시:
Thought: [충분한 정보를 수집했습니다]
Final Answer: [사용자에게 전달할 최종 답변]

## 제약사항
- 도구 없이 알 수 있는 정보는 바로 Final Answer로 답변
- 개인정보(이름, 주민번호, 전화번호)를 도구에 그대로 전달 금지
- 한국어로 답변${options.systemPromptSuffix ? `\n${options.systemPromptSuffix}` : ''}`;

  const messages: LLMMessage[] = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: maskedQuery },
  ];

  const steps: AgentStep[] = [];
  let totalTokens = 0;
  let usedModel = '';
  let timedOut = false;

  // LLM 설정
  const llmConfig = modelConfig
    ? buildLLMConfig(modelConfig)
    : getLLMConfig();
  const provider = await createLLMProvider(llmConfig);

  for (let i = 0; i < maxIterations; i++) {
    // 타임아웃 체크
    if (Date.now() - startTime > timeoutMs) {
      timedOut = true;
      break;
    }

    let llmResponse;
    try {
      llmResponse = await provider.chat(messages, { maxTokens, temperature: 0.1 });
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      return {
        answer: '죄송합니다. AI 서비스 연결에 문제가 발생했습니다.',
        steps,
        tokensUsed: totalTokens,
        model: usedModel,
        iterations: i,
        timedOut: false,
        error: errMsg,
      };
    }

    totalTokens += llmResponse.tokensUsed;
    usedModel = llmResponse.model;

    const parsed = parseAgentResponse(llmResponse.text);
    const step: AgentStep = {
      stepIndex: i,
      thought: parsed.thought,
      isFinal: parsed.isFinal,
    };

    if (parsed.isFinal) {
      step.observation = undefined;
      steps.push(step);
      return {
        answer: maskPII(parsed.finalAnswer ?? llmResponse.text),
        steps,
        tokensUsed: totalTokens,
        model: usedModel,
        iterations: i + 1,
        timedOut: false,
      };
    }

    if (parsed.action) {
      step.action = parsed.action;
      const executor = executors[parsed.action.tool];

      if (!executor) {
        step.observation = `오류: '${parsed.action.tool}' 도구를 찾을 수 없습니다. 사용 가능한 도구: ${Object.keys(executors).join(', ')}`;
      } else {
        try {
          const result = await executor(parsed.action.params);
          step.observation = result.success
            ? result.output.slice(0, 2000) // 관측 결과 최대 2000자
            : `오류: ${result.error ?? '도구 실행 실패'}`;
        } catch (err) {
          step.observation = `오류: 도구 실행 중 예외 발생 — ${err instanceof Error ? err.message : String(err)}`;
        }
      }

      // 대화 이력에 추가
      messages.push({
        role: 'assistant',
        content: llmResponse.text,
      });
      messages.push({
        role: 'user',
        content: `Observation: ${step.observation}`,
      });
    } else {
      // Action 없이 Thought만 있는 경우 — 다음 스텝 유도
      step.observation = '도구 호출이 감지되지 않았습니다. Action을 명시하거나 Final Answer를 제공하세요.';
      messages.push({ role: 'assistant', content: llmResponse.text });
      messages.push({ role: 'user', content: `Observation: ${step.observation}` });
    }

    steps.push(step);
  }

  // 최대 반복 또는 타임아웃 도달
  const lastStep = steps[steps.length - 1];
  const fallbackAnswer = timedOut
    ? '죄송합니다. 처리 시간이 초과되었습니다. 더 간단한 질문을 해주세요.'
    : `다음 정보를 수집했습니다:\n${steps
        .filter((s) => s.observation)
        .map((s) => s.observation)
        .join('\n')}`;

  return {
    answer: maskPII(lastStep?.observation ?? fallbackAnswer),
    steps,
    tokensUsed: totalTokens,
    model: usedModel,
    iterations: maxIterations,
    timedOut,
  };
}
