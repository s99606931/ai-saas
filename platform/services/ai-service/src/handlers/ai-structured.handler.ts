// 구조화 출력 핸들러 — FR-AI26.3
// Design Ref: SVC-AI-2026 DESIGN §3
// POST /ai/structured — JSON 스키마 제약 LLM 응답 추출

import type { FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { logAiEvent } from '../lib/audit.js';
import { validateDataGrade, DataGradeViolationError } from '../lib/grade-check.js';
import type { DataGrade } from '@public-saas/types';
import { buildStructuredMessages, parseStructuredOutput } from '../lib/structured-output.js';
import type { OutputSchema } from '../lib/structured-output.js';
import { getLLMConfig, buildLLMConfig, createLLMProvider } from '../lib/llm-provider.js';
import { prisma } from '../lib/prisma.js';

const OUTPUT_SCHEMAS: OutputSchema[] = ['citizen_request', 'document_analysis', 'meeting_summary', 'risk_assessment'];

const structuredSchema = z.object({
  tenantId: z.string().uuid(),
  grade: z.enum(['O']),
  schema: z.enum(OUTPUT_SCHEMAS as [OutputSchema, ...OutputSchema[]]),
  inputText: z.string().min(1).max(100_000),
  modelId: z.string().optional(),
});

type StructuredBody = z.infer<typeof structuredSchema>;

export async function structuredOutputHandler(
  request: FastifyRequest<{ Body: StructuredBody }>,
  reply: FastifyReply,
): Promise<void> {
  const body = structuredSchema.parse(request.body);
  const actor = (request.headers['x-user-id'] as string) || 'system';

  // N2SF N-05: C/S등급 차단
  try {
    validateDataGrade(body.grade as DataGrade);
  } catch (error) {
    if (error instanceof DataGradeViolationError) {
      await logAiEvent('AI_GRADE_VIOLATION', actor, 'structured', body.tenantId, request.ip,
        request.headers['user-agent'] ?? 'unknown', { grade: body.grade, blocked: true, endpoint: 'structured' });
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
        llmConfig = buildLLMConfig({
          provider: model.provider,
          endpoint: model.endpoint,
          name: model.name,
          config: model.config,
        });
      }
    }

    const provider = await createLLMProvider(llmConfig);

    // 구조화 메시지 구성 + LLM 호출
    const messages = buildStructuredMessages(body.schema, body.inputText);
    const llmResponse = await provider.chat(messages, { maxTokens: 2048, temperature: 0.1 });

    // JSON 파싱 + 검증
    const parseResult = parseStructuredOutput(body.schema, llmResponse.text);

    await logAiEvent('STRUCTURED_OUTPUT', actor, 'structured', body.tenantId, request.ip,
      request.headers['user-agent'] ?? 'unknown', {
        schema: body.schema,
        success: parseResult.success,
        tokensUsed: llmResponse.tokensUsed,
        inputLength: body.inputText.length,
      });

    if (!parseResult.success) {
      // 파싱 실패 시 원본 응답 반환
      await reply.status(422).send({
        success: false,
        error: {
          code: 'PARSE_FAILED',
          message: parseResult.error,
          raw: parseResult.raw,
        },
      });
      return;
    }

    await reply.status(200).send({
      success: true,
      data: {
        schema: body.schema,
        result: parseResult.data,
        model: llmResponse.model,
        tokensUsed: llmResponse.tokensUsed,
      },
    });
  } catch (err) {
    request.log.error(err, '구조화 출력 실패');
    await reply.status(502).send({
      success: false,
      error: { code: 'STRUCTURED_FAILED', message: '구조화 출력 처리 중 오류가 발생했습니다.' },
    });
  }
}

