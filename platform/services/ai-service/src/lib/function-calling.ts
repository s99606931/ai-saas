// Function Calling 엔진 -- FR-ADV4.1, FR-ADV4.3, FR-ADV4.4
// Design Ref: SVC-AI-ADV-R4 DESIGN §1
// OpenAI 호환 Function Calling: tools 파라미터 + tool_choice + 다중 라운드
// CSAP: D-12 시스템 개발 보안, N2SF N-05 O등급 데이터만 처리

import { getLLMConfig, buildLLMConfig, createLLMProvider } from './llm-provider.js';
import { maskPII } from './pii-masking.js';
import type { LLMMessage } from './llm-provider.js';
import type { ToolDefinition, ToolExecutor } from './ai-tools.js';
import { toolsToOpenAISchema, parseToolCalls, parseToolArguments } from './tool-schema.js';
import type { ToolCallLog, OpenAIFunctionTool } from './tool-schema.js';

// ── 타입 정의 ──────────────────────────────────────────────────────────────

export interface FunctionCallingOptions {
  /** 최대 도구 호출 라운드 (기본 5) */
  maxRounds?: number;
  /** 도구 선택 전략: 'auto' | 'none' | 특정 도구 이름 */
  toolChoice?: 'auto' | 'none' | string;
  /** 최대 토큰 */
  maxTokens?: number;
  /** 시스템 프롬프트 */
  systemPrompt?: string;
  /** 재시도 횟수 (기본 2) */
  maxRetries?: number;
}

export interface FunctionCallResult {
  /** 최종 답변 */
  answer: string;
  /** 도구 호출 로그 */
  toolCalls: ToolCallLog[];
  /** 사용 토큰 */
  tokensUsed: number;
  /** 사용 모델 */
  model: string;
  /** 호출 라운드 수 */
  rounds: number;
}

// ── 상수 ──────────────────────────────────────────────────────────────────

const MAX_ROUNDS = 5;
const MAX_RETRIES = 2;
const DEFAULT_MAX_TOKENS = 4096;

// ── 시스템 프롬프트 ──────────────────────────────────────────────────────

const FUNCTION_CALLING_SYSTEM = `당신은 공공기관 SaaS 플랫폼의 AI 어시스턴트입니다.
사용자 질문에 답변하기 위해 제공된 도구(함수)를 활용합니다.

규칙:
- 도구 호출이 필요하면 JSON 형식으로 호출을 명시하세요
- 도구 호출 결과를 기반으로 정확하게 답변하세요
- 도구 없이 답변할 수 있으면 직접 답변하세요
- 개인정보를 도구에 전달하지 마세요
- 한국어로 답변하세요

도구 호출 형식:
[{"id": "call_0", "name": "도구이름", "arguments": {"key": "value"}}]

최종 답변 시 도구 호출 없이 직접 텍스트로 답변하세요.`;

// ── Function Calling 엔진 ──────────────────────────────────────────────────

/**
 * Function Calling 엔진
 * Plan SC: FR-ADV4.1, FR-ADV4.3, FR-ADV4.4
 *
 * OpenAI 호환 Function Calling 흐름:
 * 1. 사용자 메시지 + tools 정의 -> LLM
 * 2. LLM 응답에서 tool_calls 추출
 * 3. 각 tool_call 실행
 * 4. 결과를 대화 이력에 추가
 * 5. LLM이 최종 답변 생성 또는 추가 tool_calls
 * 6. 최대 maxRounds까지 반복
 *
 * @param messages 대화 메시지 배열
 * @param tools 도구 정의 목록
 * @param executors 도구 실행기 맵
 * @param options Function Calling 옵션
 * @param modelConfig LLM 모델 설정
 */
export async function runFunctionCalling(
  messages: LLMMessage[],
  tools: ToolDefinition[],
  executors: Record<string, ToolExecutor>,
  options: FunctionCallingOptions = {},
  modelConfig?: { provider: string; endpoint: string; name: string; config?: unknown },
): Promise<FunctionCallResult> {
  const {
    maxRounds = MAX_ROUNDS,
    toolChoice = 'auto',
    maxTokens = DEFAULT_MAX_TOKENS,
    systemPrompt,
    maxRetries = MAX_RETRIES,
  } = options;

  const llmConfig = modelConfig ? buildLLMConfig(modelConfig) : getLLMConfig();
  const provider = await createLLMProvider(llmConfig);

  // OpenAI 함수 스키마 생성
  const openaiTools: OpenAIFunctionTool[] = toolsToOpenAISchema(tools);
  const toolsList = openaiTools
    .map((t) => `- ${t.function.name}: ${t.function.description}`)
    .join('\n');

  // 대화 이력 구성
  const conversationMessages: LLMMessage[] = [
    {
      role: 'system',
      content: (systemPrompt ?? FUNCTION_CALLING_SYSTEM) + `\n\n## 사용 가능한 도구\n${toolsList}`,
    },
    ...messages.map((m) => ({
      ...m,
      content: typeof m.content === 'string' ? maskPII(m.content) : m.content,
    })),
  ];

  const allToolCalls: ToolCallLog[] = [];
  let totalTokens = 0;
  let usedModel = '';
  let finalAnswer = '';

  for (let round = 0; round < maxRounds; round++) {
    // LLM 호출
    let response;
    try {
      response = await provider.chat(conversationMessages, {
        maxTokens,
        temperature: 0.1,
      });
    } catch (err) {
      return {
        answer: '죄송합니다. AI 서비스 연결에 문제가 발생했습니다.',
        toolCalls: allToolCalls,
        tokensUsed: totalTokens,
        model: usedModel,
        rounds: round,
      };
    }

    totalTokens += response.tokensUsed;
    usedModel = response.model;

    // tool_calls 추출 시도
    const toolCallRequests = parseToolCalls(response.text);

    // 도구 호출이 없으면 최종 답변
    if (toolCallRequests.length === 0 || toolChoice === 'none') {
      finalAnswer = maskPII(response.text);
      return {
        answer: finalAnswer,
        toolCalls: allToolCalls,
        tokensUsed: totalTokens,
        model: usedModel,
        rounds: round + 1,
      };
    }

    // 도구 호출이 있으면 실행
    conversationMessages.push({
      role: 'assistant',
      content: response.text,
    });

    for (const toolCall of toolCallRequests) {
      const toolName = toolCall.function.name;
      const executor = executors[toolName];
      const args = parseToolArguments(toolCall.function.arguments);
      const startTime = Date.now();

      const callLog: ToolCallLog = {
        id: toolCall.id,
        toolName,
        arguments: args,
        result: '',
        success: false,
        durationMs: 0,
      };

      if (!executor) {
        callLog.result = `도구 '${toolName}'을 찾을 수 없습니다. 사용 가능: ${Object.keys(executors).join(', ')}`;
        callLog.durationMs = Date.now() - startTime;
      } else {
        // 재시도 메커니즘 (FR-ADV4.4)
        for (let retry = 0; retry <= maxRetries; retry++) {
          try {
            const result = await executor(args);
            callLog.success = result.success;
            callLog.result = result.success
              ? result.output.slice(0, 3000)
              : (result.error ?? '도구 실행 실패');
            break;
          } catch (err) {
            if (retry === maxRetries) {
              callLog.result = `도구 실행 오류 (${maxRetries + 1}회 시도): ${err instanceof Error ? err.message : ''}`;
            }
          }
        }
        callLog.durationMs = Date.now() - startTime;
      }

      allToolCalls.push(callLog);

      // 결과를 대화 이력에 추가
      conversationMessages.push({
        role: 'user',
        content: `[도구 결과: ${toolName}]\n${callLog.result}`,
      });
    }
  }

  // 최대 라운드 도달
  finalAnswer = allToolCalls.length > 0
    ? `다음 도구 결과를 수집했습니다:\n${allToolCalls.filter((tc) => tc.success).map((tc) => `- ${tc.toolName}: ${tc.result.slice(0, 200)}`).join('\n')}`
    : '요청 처리 중 최대 반복 횟수에 도달했습니다.';

  return {
    answer: maskPII(finalAnswer),
    toolCalls: allToolCalls,
    tokensUsed: totalTokens,
    model: usedModel,
    rounds: maxRounds,
  };
}
