// AI 워크플로우 핸들러 — FR-AI26.5
// Design Ref: SVC-AI-2026 DESIGN §5
// POST /ai/workflow — 멀티스텝 AI 파이프라인 실행
// 지원 워크플로우: citizen_request, document_review, meeting_assist

import type { FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { logAiEvent } from '../lib/audit.js';
import { validateDataGrade, DataGradeViolationError } from '../lib/grade-check.js';
import type { DataGrade } from '@public-saas/types';
import { maskPII } from '../lib/pii-masking.js';
import { buildStructuredMessages, parseStructuredOutput } from '../lib/structured-output.js';
import { getLLMConfig, buildLLMConfig, createLLMProvider } from '../lib/llm-provider.js';
import type { LLMMessage } from '../lib/llm-provider.js';
import { prisma } from '../lib/prisma.js';

// 지원 워크플로우 정의
const WORKFLOW_TYPES = ['citizen_request', 'document_review', 'meeting_assist', 'policy_draft'] as const;

const workflowSchema = z.object({
  tenantId: z.string().uuid(),
  grade: z.enum(['O']),
  workflowType: z.enum(WORKFLOW_TYPES),
  inputData: z.record(z.unknown()), // 워크플로우별 입력 데이터
  modelId: z.string().optional(),
});

type WorkflowBody = z.infer<typeof workflowSchema>;

interface WorkflowStepResult {
  step: string;
  status: 'success' | 'failed' | 'skipped';
  output?: unknown;
  error?: string;
  tokensUsed: number;
}

/**
 * 민원 처리 워크플로우
 * 1단계: 민원 분류 (structured output)
 * 2단계: 담당부서 배정 판단
 * 3단계: 자동 답변 초안 생성
 */
async function runCitizenRequestWorkflow(
  inputData: Record<string, unknown>,
  provider: Awaited<ReturnType<typeof createLLMProvider>>,
): Promise<WorkflowStepResult[]> {
  const steps: WorkflowStepResult[] = [];
  const requestText = String(inputData['requestText'] ?? '');

  if (!requestText) {
    return [{ step: 'validate', status: 'failed', error: 'requestText 필드가 필요합니다', tokensUsed: 0 }];
  }

  // Step 1: 민원 분류
  const classifyMessages = buildStructuredMessages('citizen_request', requestText);
  const classifyResponse = await provider.chat(classifyMessages, { maxTokens: 1024, temperature: 0.1 });
  const classifyResult = parseStructuredOutput('citizen_request', classifyResponse.text);

  steps.push({
    step: 'classify',
    status: classifyResult.success ? 'success' : 'failed',
    output: classifyResult.success ? classifyResult.data : undefined,
    error: classifyResult.success ? undefined : classifyResult.error,
    tokensUsed: classifyResponse.tokensUsed,
  });

  if (!classifyResult.success) return steps;

  const classification = classifyResult.data;

  // Step 2: 자동 답변 초안 생성 (requiresHuman이 아닌 경우)
  if (!classification.requiresHuman) {
    const draftMessages: LLMMessage[] = [
      {
        role: 'system',
        content: `당신은 ${classification.department} 소속 공무원입니다. 민원인에게 정중하고 친절하게 답변을 작성하세요.`,
      },
      {
        role: 'user',
        content: `다음 민원에 대한 공식 답변 초안을 작성하세요:

민원 내용: ${maskPII(requestText)}
분류: ${classification.category} > ${classification.subCategory}
처리 예상 일수: ${classification.estimatedDays}일

답변 형식: 공문 형식, 경어체, 구체적인 처리 절차 포함`,
      },
    ];

    const draftResponse = await provider.chat(draftMessages, { maxTokens: 2048, temperature: 0.3 });
    steps.push({
      step: 'draft_response',
      status: 'success',
      output: { draft: maskPII(draftResponse.text) },
      tokensUsed: draftResponse.tokensUsed,
    });
  } else {
    steps.push({
      step: 'draft_response',
      status: 'skipped',
      output: { reason: '인간 검토 필요 — 자동 답변 생략', department: classification.department },
      tokensUsed: 0,
    });
  }

  return steps;
}

/**
 * 문서 검토 워크플로우
 * 1단계: 문서 분석
 * 2단계: 위험 평가
 * 3단계: 개선 의견 생성
 */
async function runDocumentReviewWorkflow(
  inputData: Record<string, unknown>,
  provider: Awaited<ReturnType<typeof createLLMProvider>>,
): Promise<WorkflowStepResult[]> {
  const steps: WorkflowStepResult[] = [];
  const documentContent = String(inputData['content'] ?? '');
  const reviewFocus = String(inputData['reviewFocus'] ?? '전반적 검토');

  if (!documentContent) {
    return [{ step: 'validate', status: 'failed', error: 'content 필드가 필요합니다', tokensUsed: 0 }];
  }

  // Step 1: 문서 분석
  const analyzeMessages = buildStructuredMessages('document_analysis', documentContent);
  const analyzeResponse = await provider.chat(analyzeMessages, { maxTokens: 1536, temperature: 0.1 });
  const analyzeResult = parseStructuredOutput('document_analysis', analyzeResponse.text);

  steps.push({
    step: 'document_analysis',
    status: analyzeResult.success ? 'success' : 'failed',
    output: analyzeResult.success ? analyzeResult.data : undefined,
    error: analyzeResult.success ? undefined : analyzeResult.error,
    tokensUsed: analyzeResponse.tokensUsed,
  });

  // Step 2: 위험 평가
  const riskMessages = buildStructuredMessages('risk_assessment', documentContent);
  const riskResponse = await provider.chat(riskMessages, { maxTokens: 1024, temperature: 0.1 });
  const riskResult = parseStructuredOutput('risk_assessment', riskResponse.text);

  steps.push({
    step: 'risk_assessment',
    status: riskResult.success ? 'success' : 'failed',
    output: riskResult.success ? riskResult.data : undefined,
    error: riskResult.success ? undefined : riskResult.error,
    tokensUsed: riskResponse.tokensUsed,
  });

  // Step 3: 개선 의견 (위험도 높음인 경우)
  const hasHighRisk = riskResult.success && riskResult.data.overallRisk === '높음';
  if (hasHighRisk || reviewFocus !== '위험 없을 시 생략') {
    const improveMessages: LLMMessage[] = [
      {
        role: 'system',
        content: '공공기관 문서 품질 향상 전문가입니다. 구체적이고 실행 가능한 개선 의견을 제시합니다.',
      },
      {
        role: 'user',
        content: `다음 문서의 검토 초점(${reviewFocus})에 따라 개선 의견을 3~5개 제시하세요:

문서 내용 (요약): ${maskPII(documentContent).slice(0, 3000)}

각 의견은 "현재 문제 → 개선 방향 → 기대 효과" 형식으로 작성하세요.`,
      },
    ];

    const improveResponse = await provider.chat(improveMessages, { maxTokens: 1500, temperature: 0.3 });
    steps.push({
      step: 'improvement_suggestions',
      status: 'success',
      output: { suggestions: maskPII(improveResponse.text) },
      tokensUsed: improveResponse.tokensUsed,
    });
  }

  return steps;
}

/**
 * 회의 보조 워크플로우
 * 1단계: 회의록 분석 (structured output)
 * 2단계: 액션 아이템 이메일 초안 생성
 */
async function runMeetingAssistWorkflow(
  inputData: Record<string, unknown>,
  provider: Awaited<ReturnType<typeof createLLMProvider>>,
): Promise<WorkflowStepResult[]> {
  const steps: WorkflowStepResult[] = [];
  const transcript = String(inputData['transcript'] ?? '');

  if (!transcript) {
    return [{ step: 'validate', status: 'failed', error: 'transcript 필드가 필요합니다', tokensUsed: 0 }];
  }

  // Step 1: 회의록 구조화
  const summaryMessages = buildStructuredMessages('meeting_summary', transcript);
  const summaryResponse = await provider.chat(summaryMessages, { maxTokens: 2048, temperature: 0.1 });
  const summaryResult = parseStructuredOutput('meeting_summary', summaryResponse.text);

  steps.push({
    step: 'meeting_summary',
    status: summaryResult.success ? 'success' : 'failed',
    output: summaryResult.success ? summaryResult.data : undefined,
    error: summaryResult.success ? undefined : summaryResult.error,
    tokensUsed: summaryResponse.tokensUsed,
  });

  if (summaryResult.success && summaryResult.data.actionItems.length > 0) {
    // Step 2: 액션 아이템 알림 메시지 생성
    const actionItems = summaryResult.data.actionItems
      .map((a, i) => `${i + 1}. [${a.assignee}] ${a.task} (기한: ${a.dueDate})`)
      .join('\n');

    const emailMessages: LLMMessage[] = [
      {
        role: 'system',
        content: '회의 결과 공문 작성 전문가입니다. 간결하고 명확한 결과 통보문을 작성합니다.',
      },
      {
        role: 'user',
        content: `다음 회의 결과를 내부 공문 형식으로 작성하세요:

회의명: ${summaryResult.data.title}
일시: ${summaryResult.data.date}
참석자: ${summaryResult.data.participants.join(', ')}

액션 아이템:
${actionItems}

결정사항:
${summaryResult.data.decisions.join('\n')}`,
      },
    ];

    const emailResponse = await provider.chat(emailMessages, { maxTokens: 1024, temperature: 0.2 });
    steps.push({
      step: 'action_notification',
      status: 'success',
      output: { notification: maskPII(emailResponse.text) },
      tokensUsed: emailResponse.tokensUsed,
    });
  }

  return steps;
}

/**
 * 정책 초안 작성 워크플로우
 */
async function runPolicyDraftWorkflow(
  inputData: Record<string, unknown>,
  provider: Awaited<ReturnType<typeof createLLMProvider>>,
): Promise<WorkflowStepResult[]> {
  const topic = String(inputData['topic'] ?? '');
  const background = String(inputData['background'] ?? '');
  const objectives = String(inputData['objectives'] ?? '');

  if (!topic) {
    return [{ step: 'validate', status: 'failed', error: 'topic 필드가 필요합니다', tokensUsed: 0 }];
  }

  const messages: LLMMessage[] = [
    {
      role: 'system',
      content: `당신은 공공기관 정책 문서 작성 전문가입니다.
행안부 지침에 따라 정책 초안을 작성합니다.
반드시 한국어로 작성하며, 공공기관 공문서 형식을 준수합니다.`,
    },
    {
      role: 'user',
      content: `다음 주제의 정책 초안을 작성하세요:

주제: ${topic}
배경: ${background || '별도 배경 없음'}
목표: ${objectives || '효율적 공공서비스 제공'}

작성 형식:
1. 정책 목적 및 배경
2. 주요 내용 (정책 방향 3~5개)
3. 추진 전략
4. 기대 효과
5. 추진 일정 (단계별)
6. 소요 예산 (개략)
7. 위험 요소 및 대응 방안

공공기관 계획서 형식으로 작성하세요.`,
    },
  ];

  const response = await provider.chat(messages, { maxTokens: 4096, temperature: 0.4 });

  return [
    {
      step: 'policy_draft',
      status: 'success',
      output: { draft: maskPII(response.text) },
      tokensUsed: response.tokensUsed,
    },
  ];
}

// ── 워크플로우 핸들러 ────────────────────────────────────────────────────

export async function workflowHandler(
  request: FastifyRequest<{ Body: WorkflowBody }>,
  reply: FastifyReply,
): Promise<void> {
  const body = workflowSchema.parse(request.body);
  const actor = (request.headers['x-user-id'] as string) || 'system';

  // N2SF N-05: C/S등급 차단
  try {
    validateDataGrade(body.grade as DataGrade);
  } catch (error) {
    if (error instanceof DataGradeViolationError) {
      await logAiEvent('AI_GRADE_VIOLATION', actor, 'workflow', body.tenantId, request.ip,
        request.headers['user-agent'] ?? 'unknown', { grade: body.grade, blocked: true, endpoint: 'workflow' });
      await reply.status(403).send({ success: false, error: { code: error.code, message: error.message } });
      return;
    }
    throw error;
  }

  try {
    // 모델 설정 조회
    let llmConfig = getLLMConfig();
    if (body.modelId) {
      const model = await prisma.aiModel.findUnique({ where: { id: body.modelId } });
      if (model?.isActive) {
        llmConfig = buildLLMConfig({ provider: model.provider, endpoint: model.endpoint, name: model.name, config: model.config });
      }
    }

    const provider = await createLLMProvider(llmConfig);
    const startTime = Date.now();

    // 워크플로우 선택 실행
    let steps: WorkflowStepResult[];
    switch (body.workflowType) {
      case 'citizen_request':
        steps = await runCitizenRequestWorkflow(body.inputData, provider);
        break;
      case 'document_review':
        steps = await runDocumentReviewWorkflow(body.inputData, provider);
        break;
      case 'meeting_assist':
        steps = await runMeetingAssistWorkflow(body.inputData, provider);
        break;
      case 'policy_draft':
        steps = await runPolicyDraftWorkflow(body.inputData, provider);
        break;
    }

    const totalTokens = steps.reduce((sum, s) => sum + s.tokensUsed, 0);
    const durationMs = Date.now() - startTime;
    const successCount = steps.filter((s) => s.status === 'success').length;

    await logAiEvent('WORKFLOW_RUN', actor, 'workflow', body.tenantId, request.ip,
      request.headers['user-agent'] ?? 'unknown', {
        workflowType: body.workflowType,
        stepCount: steps.length,
        successCount,
        tokensUsed: totalTokens,
        durationMs,
      });

    await reply.status(200).send({
      success: true,
      data: {
        workflowType: body.workflowType,
        steps,
        summary: {
          total: steps.length,
          success: successCount,
          failed: steps.filter((s) => s.status === 'failed').length,
          skipped: steps.filter((s) => s.status === 'skipped').length,
        },
        tokensUsed: totalTokens,
        durationMs,
      },
    });
  } catch (err) {
    request.log.error(err, '워크플로우 실행 실패');
    await reply.status(502).send({
      success: false,
      error: { code: 'WORKFLOW_FAILED', message: 'AI 워크플로우 실행 중 오류가 발생했습니다.' },
    });
  }
}
