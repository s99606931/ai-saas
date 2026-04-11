// Plan-Execute 패턴 에이전트 -- FR-ADV2.1
// Design Ref: SVC-AI-ADV-R2 DESIGN §1
// LLM이 실행 계획 수립 -> 단계별 도구/추론 실행 -> 결과 종합
// CSAP: D-12 시스템 개발 보안, N2SF N-05 O등급 데이터만 처리

import { getLLMConfig, buildLLMConfig, createLLMProvider } from './llm-provider.js';
import { maskPII } from './pii-masking.js';
import type { LLMMessage, LLMResponse } from './llm-provider.js';
import type { ToolDefinition, ToolExecutor } from './ai-tools.js';

// ── 타입 정의 ──────────────────────────────────────────────────────────────

export interface PlanStep {
  stepIndex: number;
  description: string;
  tool?: string;
  toolParams?: Record<string, unknown>;
  dependsOn?: number[];
  status: 'pending' | 'running' | 'completed' | 'failed';
  result?: string;
}

export interface ExecutionPlan {
  goal: string;
  steps: PlanStep[];
  reasoning: string;
}

export interface PlanExecuteResult {
  answer: string;
  plan: ExecutionPlan;
  steps: PlanStep[];
  replanned: boolean;
  tokensUsed: number;
  model: string;
  executionTimeMs: number;
}

export interface PlanExecuteOptions {
  maxSteps?: number;
  stepTimeoutMs?: number;
  totalTimeoutMs?: number;
  maxTokens?: number;
  additionalContext?: string;
}

// ── 상수 ──────────────────────────────────────────────────────────────────

const MAX_STEPS = 8;
const STEP_TIMEOUT_MS = 30_000;
const TOTAL_TIMEOUT_MS = 180_000;
const TOKEN_BUDGET = 4096;

// ── 프롬프트 ──────────────────────────────────────────────────────────────

function buildPlannerSystemPrompt(tools: ToolDefinition[]): string {
  const toolList = tools
    .map((t) => {
      const params = Object.entries(t.parameters)
        .map(([k, v]) => `    ${k} (${v.type}${v.required ? ', 필수' : ''}): ${v.description}`)
        .join('\n');
      return `  - ${t.name}: ${t.description}\n    파라미터:\n${params || '    없음'}`;
    })
    .join('\n');

  return `당신은 공공기관 SaaS 플랫폼의 AI 작업 플래너입니다.
사용자 요청을 분석하여 단계별 실행 계획을 수립합니다.

## 사용 가능한 도구
${toolList}

## 응답 형식 (반드시 JSON으로)
\`\`\`json
{
  "goal": "사용자 요청의 핵심 목표",
  "reasoning": "이 계획을 세운 이유",
  "steps": [
    {
      "stepIndex": 0,
      "description": "이 단계에서 할 일",
      "tool": "도구이름 (없으면 null — LLM 추론)",
      "toolParams": {"param1": "value1"},
      "dependsOn": []
    }
  ]
}
\`\`\`

## 규칙
- 최대 ${MAX_STEPS}단계 이내로 계획
- 각 단계는 명확하고 검증 가능해야 함
- 도구 없이 해결 가능한 단계는 tool을 null로 설정
- dependsOn으로 단계 간 의존성 명시
- 개인정보를 도구 파라미터에 직접 포함 금지
- 한국어로 작성`;
}

const SYNTHESIS_SYSTEM_PROMPT = `당신은 공공기관 AI 어시스턴트입니다.
아래 실행 결과들을 종합하여 사용자에게 명확하고 유용한 최종 답변을 작성하세요.
한국어로, 공공기관 공문서 스타일로 작성하세요.`;

// ── 계획 파싱 ──────────────────────────────────────────────────────────────

/**
 * LLM 응답에서 실행 계획 파싱
 */
function parsePlan(text: string): ExecutionPlan | null {
  // JSON 블록 추출
  const codeBlockMatch = /```(?:json)?\s*\n?([\s\S]*?)\n?```/.exec(text);
  const jsonStr = codeBlockMatch?.[1] ?? text;

  const jsonMatch = /\{[\s\S]*\}/.exec(jsonStr);
  if (!jsonMatch) return null;

  try {
    const parsed = JSON.parse(jsonMatch[0]) as Record<string, unknown>;
    const steps = parsed['steps'];
    if (!Array.isArray(steps)) return null;

    return {
      goal: String(parsed['goal'] ?? ''),
      reasoning: String(parsed['reasoning'] ?? ''),
      steps: steps.map((s: Record<string, unknown>, idx: number) => ({
        stepIndex: typeof s['stepIndex'] === 'number' ? s['stepIndex'] : idx,
        description: String(s['description'] ?? ''),
        tool: s['tool'] && s['tool'] !== 'null' ? String(s['tool']) : undefined,
        toolParams: (s['toolParams'] as Record<string, unknown>) ?? undefined,
        dependsOn: Array.isArray(s['dependsOn']) ? (s['dependsOn'] as number[]) : [],
        status: 'pending' as const,
      })),
    };
  } catch {
    return null;
  }
}

// ── Plan-Execute 메인 함수 ────────────────────────────────────────────────

/**
 * Plan-Execute 패턴 에이전트
 * Plan SC: FR-ADV2.1
 *
 * 1. LLM이 실행 계획(단계 목록) 수립
 * 2. 각 단계를 순차 실행 (도구 호출 또는 LLM 추론)
 * 3. 실패 시 재계획(re-plan) 최대 1회
 * 4. 전체 결과 종합 -> 최종 답변 생성
 *
 * @param query 사용자 질문/요청
 * @param tools 도구 정의 목록
 * @param executors 도구 실행기 맵
 * @param options Plan-Execute 옵션
 * @param modelConfig LLM 모델 설정
 */
export async function runPlanExecute(
  query: string,
  tools: ToolDefinition[],
  executors: Record<string, ToolExecutor>,
  options: PlanExecuteOptions = {},
  modelConfig?: { provider: string; endpoint: string; name: string; config?: unknown },
): Promise<PlanExecuteResult> {
  const {
    maxSteps = MAX_STEPS,
    stepTimeoutMs = STEP_TIMEOUT_MS,
    totalTimeoutMs = TOTAL_TIMEOUT_MS,
    maxTokens = TOKEN_BUDGET,
    additionalContext,
  } = options;

  const startTime = Date.now();
  let totalTokens = 0;
  let usedModel = '';
  let replanned = false;

  const maskedQuery = maskPII(query);
  const llmConfig = modelConfig ? buildLLMConfig(modelConfig) : getLLMConfig();
  const provider = await createLLMProvider(llmConfig);

  // ── PHASE 1: 계획 수립 ──────────────────────────────────────────────────

  const planMessages: LLMMessage[] = [
    { role: 'system', content: buildPlannerSystemPrompt(tools) },
    {
      role: 'user',
      content: additionalContext
        ? `[맥락]\n${additionalContext}\n\n[요청]\n${maskedQuery}`
        : maskedQuery,
    },
  ];

  let planResponse: LLMResponse;
  try {
    planResponse = await provider.chat(planMessages, { maxTokens, temperature: 0.2 });
  } catch (err) {
    return {
      answer: '죄송합니다. 실행 계획 수립 중 AI 서비스 오류가 발생했습니다.',
      plan: { goal: maskedQuery, steps: [], reasoning: 'LLM 호출 실패' },
      steps: [],
      replanned: false,
      tokensUsed: 0,
      model: '',
      executionTimeMs: Date.now() - startTime,
    };
  }

  totalTokens += planResponse.tokensUsed;
  usedModel = planResponse.model;

  let plan = parsePlan(planResponse.text);
  if (!plan || plan.steps.length === 0) {
    // 계획 파싱 실패 시 단일 LLM 추론으로 폴백
    return {
      answer: maskPII(planResponse.text),
      plan: { goal: maskedQuery, steps: [], reasoning: '계획 파싱 실패 — 직접 답변' },
      steps: [],
      replanned: false,
      tokensUsed: totalTokens,
      model: usedModel,
      executionTimeMs: Date.now() - startTime,
    };
  }

  // 단계 수 제한
  if (plan.steps.length > maxSteps) {
    plan.steps = plan.steps.slice(0, maxSteps);
  }

  // ── PHASE 2: 단계별 실행 ─────────────────────────────────────────────────

  const executedSteps = [...plan.steps];
  let failedStepIndex = -1;

  for (let i = 0; i < executedSteps.length; i++) {
    const step = executedSteps[i];
    if (!step) continue;

    // 총 타임아웃 체크
    if (Date.now() - startTime > totalTimeoutMs) {
      step.status = 'failed';
      step.result = '전체 실행 시간 초과';
      break;
    }

    // 의존 단계 완료 확인
    if (step.dependsOn && step.dependsOn.length > 0) {
      const allDepsCompleted = step.dependsOn.every(
        (depIdx) => executedSteps[depIdx]?.status === 'completed',
      );
      if (!allDepsCompleted) {
        step.status = 'failed';
        step.result = '의존 단계 미완료';
        failedStepIndex = i;
        break;
      }
    }

    step.status = 'running';

    if (step.tool && executors[step.tool]) {
      // 도구 실행
      try {
        const executor = executors[step.tool];
        if (!executor) {
          step.status = 'failed';
          step.result = `도구 '${step.tool}'을 찾을 수 없습니다`;
          failedStepIndex = i;
          continue;
        }

        const timeoutPromise = new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('단계 실행 시간 초과')), stepTimeoutMs),
        );

        const result = await Promise.race([
          executor(step.toolParams ?? {}),
          timeoutPromise,
        ]);

        if (result.success) {
          step.status = 'completed';
          step.result = result.output.slice(0, 3000); // 결과 크기 제한
        } else {
          step.status = 'failed';
          step.result = result.error ?? '도구 실행 실패';
          failedStepIndex = i;
        }
      } catch (err) {
        step.status = 'failed';
        step.result = err instanceof Error ? err.message : '도구 실행 오류';
        failedStepIndex = i;
      }
    } else if (step.tool && !executors[step.tool]) {
      // 도구 없음
      step.status = 'failed';
      step.result = `도구 '${step.tool}'이 등록되지 않았습니다`;
      failedStepIndex = i;
    } else {
      // LLM 추론 단계
      try {
        // 이전 단계 결과를 컨텍스트로 제공
        const prevResults = executedSteps
          .filter((s) => s.status === 'completed' && s.result)
          .map((s) => `[${s.description}]\n${s.result}`)
          .join('\n\n');

        const reasonMessages: LLMMessage[] = [
          {
            role: 'system',
            content: '공공기관 AI 어시스턴트입니다. 주어진 맥락을 기반으로 요청을 처리하세요. 한국어로 답변하세요.',
          },
          {
            role: 'user',
            content: `## 원본 요청\n${maskedQuery}\n\n## 현재 단계\n${step.description}\n\n## 이전 단계 결과\n${prevResults || '없음'}`,
          },
        ];

        const reasonResponse = await provider.chat(reasonMessages, { maxTokens: 1024, temperature: 0.3 });
        totalTokens += reasonResponse.tokensUsed;
        step.status = 'completed';
        step.result = maskPII(reasonResponse.text).slice(0, 3000);
      } catch {
        step.status = 'failed';
        step.result = 'LLM 추론 실패';
        failedStepIndex = i;
      }
    }
  }

  // ── PHASE 2.5: 재계획 (실패 시 1회) ────────────────────────────────────

  if (failedStepIndex >= 0 && !replanned && Date.now() - startTime < totalTimeoutMs) {
    replanned = true;
    const completedResults = executedSteps
      .filter((s) => s.status === 'completed')
      .map((s) => `단계 ${s.stepIndex}: ${s.description} -> ${s.result}`)
      .join('\n');

    const failedStep = executedSteps[failedStepIndex];
    const replanMessages: LLMMessage[] = [
      { role: 'system', content: buildPlannerSystemPrompt(tools) },
      {
        role: 'user',
        content: `원본 요청: ${maskedQuery}\n\n완료된 단계:\n${completedResults || '없음'}\n\n실패한 단계: ${failedStep?.description ?? ''} (사유: ${failedStep?.result ?? '알 수 없음'})\n\n남은 작업을 완료하기 위한 새 계획을 세워주세요.`,
      },
    ];

    try {
      const replanResponse = await provider.chat(replanMessages, { maxTokens, temperature: 0.2 });
      totalTokens += replanResponse.tokensUsed;

      const newPlan = parsePlan(replanResponse.text);
      if (newPlan && newPlan.steps.length > 0) {
        // 새 단계 실행
        for (const newStep of newPlan.steps.slice(0, 3)) {
          if (Date.now() - startTime > totalTimeoutMs) break;

          newStep.status = 'running';
          if (newStep.tool && executors[newStep.tool]) {
            try {
              const result = await executors[newStep.tool]!(newStep.toolParams ?? {});
              newStep.status = result.success ? 'completed' : 'failed';
              newStep.result = result.success ? result.output.slice(0, 3000) : (result.error ?? '실패');
            } catch {
              newStep.status = 'failed';
              newStep.result = '재계획 도구 실행 오류';
            }
          } else {
            // LLM 추론
            try {
              const response = await provider.chat(
                [{ role: 'user', content: `${maskedQuery}\n\n현재 단계: ${newStep.description}` }],
                { maxTokens: 1024 },
              );
              totalTokens += response.tokensUsed;
              newStep.status = 'completed';
              newStep.result = maskPII(response.text).slice(0, 3000);
            } catch {
              newStep.status = 'failed';
            }
          }
          executedSteps.push(newStep);
        }
      }
    } catch {
      // 재계획 실패 — 기존 결과로 진행
    }
  }

  // ── PHASE 3: 결과 종합 ──────────────────────────────────────────────────

  const completedResults = executedSteps
    .filter((s) => s.status === 'completed' && s.result)
    .map((s) => `## ${s.description}\n${s.result}`)
    .join('\n\n');

  let finalAnswer: string;

  if (completedResults.length > 0) {
    try {
      const synthMessages: LLMMessage[] = [
        { role: 'system', content: SYNTHESIS_SYSTEM_PROMPT },
        {
          role: 'user',
          content: `## 원본 요청\n${maskedQuery}\n\n## 실행 결과\n${completedResults}`,
        },
      ];

      const synthResponse = await provider.chat(synthMessages, { maxTokens: 2048 });
      totalTokens += synthResponse.tokensUsed;
      finalAnswer = maskPII(synthResponse.text);
    } catch {
      finalAnswer = completedResults;
    }
  } else {
    finalAnswer = '죄송합니다. 요청을 처리할 수 없었습니다. 더 구체적인 질문을 해주세요.';
  }

  return {
    answer: finalAnswer,
    plan,
    steps: executedSteps,
    replanned,
    tokensUsed: totalTokens,
    model: usedModel,
    executionTimeMs: Date.now() - startTime,
  };
}
