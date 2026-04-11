// Multi-Agent 오케스트레이터 -- FR-ADV2.5
// Design Ref: SVC-AI-ADV-R2 DESIGN §4
// 복잡한 작업을 전문 서브에이전트에게 위임하여 순차 실행
// CSAP: D-12 시스템 개발 보안, N2SF N-05 O등급 데이터만 처리

import { getLLMConfig, buildLLMConfig, createLLMProvider } from './llm-provider.js';
import { maskPII } from './pii-masking.js';
import type { LLMMessage } from './llm-provider.js';

// ── 타입 정의 ──────────────────────────────────────────────────────────────

export type SubAgentRole = 'researcher' | 'analyst' | 'writer' | 'reviewer';

export interface SubAgentTask {
  role: SubAgentRole;
  instruction: string;
  context?: string;
  tools?: string[];
}

export interface SubAgentResult {
  role: SubAgentRole;
  result: string;
  tokensUsed: number;
}

export interface OrchestratorResult {
  answer: string;
  subAgentResults: SubAgentResult[];
  totalTokensUsed: number;
  model: string;
  executionTimeMs: number;
}

export interface OrchestratorOptions {
  maxSubAgents?: number;
  maxTokensPerAgent?: number;
  totalTimeoutMs?: number;
  additionalContext?: string;
}

// ── 서브에이전트 시스템 프롬프트 ────────────────────────────────────────────

const SUB_AGENT_PROMPTS: Record<SubAgentRole, string> = {
  researcher: `당신은 공공기관 정보 조사 전문 AI입니다.
주어진 주제에 대해 체계적으로 정보를 수집하고 정리합니다.
사실에 기반하여 답변하고, 불확실한 정보는 명시하세요.
한국어로 작성하세요.`,

  analyst: `당신은 공공기관 데이터 분석 전문 AI입니다.
주어진 데이터와 정보를 분석하여 인사이트를 도출합니다.
통계적 근거와 논리적 추론을 제시하세요.
한국어로 작성하세요.`,

  writer: `당신은 공공기관 문서 작성 전문 AI입니다.
공문서, 보고서, 계획서 등을 공공기관 표준 형식으로 작성합니다.
명확하고 간결한 행정 문체를 사용하세요.
한국어로 작성하세요.`,

  reviewer: `당신은 공공기관 문서 검토 전문 AI입니다.
작성된 문서의 완전성, 정확성, 형식 준수를 검토합니다.
개선 사항을 구체적으로 제안하세요.
한국어로 작성하세요.`,
};

// ── 오케스트레이터 ──────────────────────────────────────────────────────────

const ORCHESTRATOR_SYSTEM_PROMPT = `당신은 공공기관 SaaS 플랫폼의 작업 조율 AI입니다.
사용자 요청을 분석하여 적절한 전문 에이전트에게 작업을 분배합니다.

사용 가능한 에이전트:
- researcher: 정보 조사/수집
- analyst: 데이터 분석/인사이트
- writer: 문서 작성/편집
- reviewer: 문서 검토/피드백

반드시 아래 JSON 형식으로 응답하세요:
\`\`\`json
{
  "tasks": [
    {"role": "researcher", "instruction": "조사할 내용"},
    {"role": "analyst", "instruction": "분석할 내용"},
    {"role": "writer", "instruction": "작성할 내용"}
  ],
  "reasoning": "이렇게 분배한 이유"
}
\`\`\`

규칙:
- 각 에이전트에게 명확하고 구체적인 지시 제공
- 순차 실행: 이전 에이전트 결과가 다음 에이전트에게 전달됨
- 최소한의 에이전트만 사용 (비용 효율)
- 개인정보 포함 금지`;

/**
 * 오케스트레이터 작업 분배 파싱
 */
function parseOrchestration(text: string): SubAgentTask[] | null {
  const codeBlockMatch = /```(?:json)?\s*\n?([\s\S]*?)\n?```/.exec(text);
  const jsonStr = codeBlockMatch?.[1] ?? text;
  const jsonMatch = /\{[\s\S]*\}/.exec(jsonStr);
  if (!jsonMatch) return null;

  try {
    const parsed = JSON.parse(jsonMatch[0]) as Record<string, unknown>;
    const tasks = parsed['tasks'];
    if (!Array.isArray(tasks)) return null;

    const validRoles: SubAgentRole[] = ['researcher', 'analyst', 'writer', 'reviewer'];

    return tasks
      .filter((t: Record<string, unknown>) =>
        validRoles.includes(t['role'] as SubAgentRole) && typeof t['instruction'] === 'string',
      )
      .map((t: Record<string, unknown>) => ({
        role: t['role'] as SubAgentRole,
        instruction: String(t['instruction']),
      }));
  } catch {
    return null;
  }
}

/**
 * Multi-Agent 오케스트레이터
 * Plan SC: FR-ADV2.5
 *
 * 1. 오케스트레이터가 사용자 요청을 분석하여 작업 분배
 * 2. 각 서브에이전트가 순차 실행 (이전 결과를 컨텍스트로 전달)
 * 3. 최종 결과 종합
 *
 * @param query 사용자 요청
 * @param subAgentRoles 사용할 서브에이전트 역할 (없으면 자동 결정)
 * @param options 오케스트레이터 옵션
 * @param modelConfig LLM 모델 설정
 */
export async function runOrchestrator(
  query: string,
  subAgentRoles?: SubAgentRole[],
  options: OrchestratorOptions = {},
  modelConfig?: { provider: string; endpoint: string; name: string; config?: unknown },
): Promise<OrchestratorResult> {
  const {
    maxSubAgents = 4,
    maxTokensPerAgent = 2048,
    totalTimeoutMs = 180_000,
    additionalContext,
  } = options;

  const startTime = Date.now();
  let totalTokens = 0;
  let usedModel = '';

  const maskedQuery = maskPII(query);
  const llmConfig = modelConfig ? buildLLMConfig(modelConfig) : getLLMConfig();
  const provider = await createLLMProvider(llmConfig);

  // ── PHASE 1: 작업 분배 ──────────────────────────────────────────────────

  let tasks: SubAgentTask[];

  if (subAgentRoles && subAgentRoles.length > 0) {
    // 명시적 역할 지정 시 기본 지시 생성
    tasks = subAgentRoles.map((role) => ({
      role,
      instruction: `"${maskedQuery}"에 대해 ${role} 역할로 처리하세요.`,
    }));
  } else {
    // 자동 작업 분배
    const orchMessages: LLMMessage[] = [
      { role: 'system', content: ORCHESTRATOR_SYSTEM_PROMPT },
      {
        role: 'user',
        content: additionalContext
          ? `[맥락]\n${additionalContext}\n\n[요청]\n${maskedQuery}`
          : maskedQuery,
      },
    ];

    try {
      const orchResponse = await provider.chat(orchMessages, { maxTokens: 1024, temperature: 0.2 });
      totalTokens += orchResponse.tokensUsed;
      usedModel = orchResponse.model;

      tasks = parseOrchestration(orchResponse.text) ?? [];
    } catch {
      return {
        answer: '죄송합니다. 작업 분배 중 오류가 발생했습니다.',
        subAgentResults: [],
        totalTokensUsed: 0,
        model: '',
        executionTimeMs: Date.now() - startTime,
      };
    }
  }

  if (tasks.length === 0) {
    // 작업 분배 실패 시 직접 답변
    try {
      const directResponse = await provider.chat(
        [{ role: 'user', content: maskedQuery }],
        { maxTokens: maxTokensPerAgent },
      );
      totalTokens += directResponse.tokensUsed;
      return {
        answer: maskPII(directResponse.text),
        subAgentResults: [],
        totalTokensUsed: totalTokens,
        model: directResponse.model,
        executionTimeMs: Date.now() - startTime,
      };
    } catch {
      return {
        answer: '죄송합니다. 요청을 처리할 수 없었습니다.',
        subAgentResults: [],
        totalTokensUsed: totalTokens,
        model: usedModel,
        executionTimeMs: Date.now() - startTime,
      };
    }
  }

  // 서브에이전트 수 제한
  const limitedTasks = tasks.slice(0, maxSubAgents);

  // ── PHASE 2: 서브에이전트 순차 실행 ─────────────────────────────────────

  const subAgentResults: SubAgentResult[] = [];
  let accumulatedContext = '';

  for (const task of limitedTasks) {
    // 타임아웃 체크
    if (Date.now() - startTime > totalTimeoutMs) break;

    const systemPrompt = SUB_AGENT_PROMPTS[task.role] ?? SUB_AGENT_PROMPTS.researcher;

    const messages: LLMMessage[] = [
      { role: 'system', content: systemPrompt },
      {
        role: 'user',
        content: accumulatedContext
          ? `[이전 작업 결과]\n${accumulatedContext}\n\n[현재 지시]\n${task.instruction}`
          : `[요청]\n${maskedQuery}\n\n[지시]\n${task.instruction}`,
      },
    ];

    try {
      const response = await provider.chat(messages, {
        maxTokens: maxTokensPerAgent,
        temperature: 0.3,
      });

      totalTokens += response.tokensUsed;
      usedModel = response.model;

      const maskedResult = maskPII(response.text);
      subAgentResults.push({
        role: task.role,
        result: maskedResult,
        tokensUsed: response.tokensUsed,
      });

      // 다음 에이전트에게 전달할 컨텍스트 누적
      accumulatedContext += `\n\n[${task.role}]\n${maskedResult.slice(0, 2000)}`;
    } catch {
      subAgentResults.push({
        role: task.role,
        result: `${task.role} 에이전트 실행 실패`,
        tokensUsed: 0,
      });
    }
  }

  // ── PHASE 3: 최종 답변 종합 ─────────────────────────────────────────────

  const allResults = subAgentResults
    .map((r) => `## ${r.role}\n${r.result}`)
    .join('\n\n');

  let finalAnswer: string;

  if (subAgentResults.length > 1) {
    // 여러 에이전트 결과 종합
    try {
      const synthMessages: LLMMessage[] = [
        {
          role: 'system',
          content: '공공기관 AI 어시스턴트입니다. 아래 전문가 에이전트 결과를 종합하여 최종 답변을 작성하세요. 한국어로, 명확하고 구조적으로 작성하세요.',
        },
        {
          role: 'user',
          content: `## 원본 요청\n${maskedQuery}\n\n## 전문가 결과\n${allResults}`,
        },
      ];

      const synthResponse = await provider.chat(synthMessages, { maxTokens: 2048 });
      totalTokens += synthResponse.tokensUsed;
      finalAnswer = maskPII(synthResponse.text);
    } catch {
      finalAnswer = allResults;
    }
  } else if (subAgentResults.length === 1 && subAgentResults[0]) {
    finalAnswer = subAgentResults[0].result;
  } else {
    finalAnswer = '죄송합니다. 요청을 처리할 수 없었습니다.';
  }

  return {
    answer: finalAnswer,
    subAgentResults,
    totalTokensUsed: totalTokens,
    model: usedModel,
    executionTimeMs: Date.now() - startTime,
  };
}
