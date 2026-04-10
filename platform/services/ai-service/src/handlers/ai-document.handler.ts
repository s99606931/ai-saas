// 장문서 분석 핸들러 — FR-AI26.4
// Design Ref: SVC-AI-2026 DESIGN §4
// POST /ai/document/analyze — 장문 공공문서 분석 (128K 컨텍스트)
// POST /ai/document/compare — 문서 비교 분석

import type { FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { logAiEvent } from '../lib/audit.js';
import { validateDataGrade, DataGradeViolationError } from '../lib/grade-check.js';
import type { DataGrade } from '@public-saas/types';
import { maskPII } from '../lib/pii-masking.js';
import { getLLMConfig, buildLLMConfig, createLLMProvider } from '../lib/llm-provider.js';
import type { LLMMessage } from '../lib/llm-provider.js';
import { prisma } from '../lib/prisma.js';

// ── 단일 문서 분석 ────────────────────────────────────────────────────────

const analyzeSchema = z.object({
  tenantId: z.string().uuid(),
  grade: z.enum(['O']),
  content: z.string().min(1).max(300_000), // 최대 30만자 (약 150K 토큰)
  analysisType: z.enum(['summary', 'risk', 'extract', 'classify', 'full']).default('full'),
  docType: z.string().max(50).optional(),
  modelId: z.string().optional(),
});

type AnalyzeBody = z.infer<typeof analyzeSchema>;

const ANALYSIS_PROMPTS: Record<string, string> = {
  summary: `다음 공공문서를 분석하여 아래 항목을 한국어로 작성하세요:

1. **문서 개요** (3문장 이내)
2. **핵심 사항** (최대 5개 불릿포인트)
3. **주요 결정사항** 또는 **조치 필요 사항**
4. **중요 일정/기한**

공공기관 공문서 스타일로 간결하게 작성하세요.`,

  risk: `다음 문서의 위험 요소를 분석하세요:

1. **법적·규정 위험** (관련 법령 포함)
2. **재정적 위험** (예산, 비용 관련)
3. **운영적 위험** (실행 가능성, 일정 위험)
4. **정치적·사회적 위험**

각 위험 항목에 대해 심각도(높음/보통/낮음)와 완화 방안을 제시하세요.`,

  extract: `다음 문서에서 구조화된 정보를 추출하세요:

- **제목**:
- **문서 유형**:
- **작성일**:
- **작성 기관**:
- **수신 기관**:
- **핵심 수치/금액**:
- **언급된 법령**:
- **다음 조치 필요 사항**:
- **관련 담당자**:`,

  classify: `다음 문서를 공공기관 분류 체계에 따라 분류하세요:

- **문서 분류**: (계획서/보고서/공문/지침/계약서/기타)
- **업무 영역**:
- **보안 등급 추천**: (일반/대외비/비밀)
- **보존 기간 추천**: (1년/3년/5년/10년/영구)
- **처리 상태**: (결재필요/참조/이행중/완료)`,

  full: `다음 공공문서를 종합 분석하여 구조화된 보고서를 작성하세요:

## 1. 문서 개요
(제목, 유형, 작성 기관, 날짜)

## 2. 핵심 내용 요약
(주요 내용을 3~5문장으로)

## 3. 핵심 결정사항 및 지시사항

## 4. 위험 요소 및 주의사항

## 5. 필요 조치 및 일정

## 6. 관련 법령·규정

## 7. AI 분석 종합 의견

공공기관 공문서 표준 양식에 맞게 작성하세요.`,
};

export async function documentAnalyzeHandler(
  request: FastifyRequest<{ Body: AnalyzeBody }>,
  reply: FastifyReply,
): Promise<void> {
  const body = analyzeSchema.parse(request.body);
  const actor = (request.headers['x-user-id'] as string) || 'system';

  // N2SF N-05: C/S등급 차단
  try {
    validateDataGrade(body.grade as DataGrade);
  } catch (error) {
    if (error instanceof DataGradeViolationError) {
      await logAiEvent('AI_GRADE_VIOLATION', actor, 'document', body.tenantId, request.ip,
        request.headers['user-agent'] ?? 'unknown', { grade: body.grade, blocked: true, endpoint: 'document/analyze' });
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
    const maskedContent = maskPII(body.content);
    const analysisPrompt = ANALYSIS_PROMPTS[body.analysisType] ?? ANALYSIS_PROMPTS['full']!;

    const messages: LLMMessage[] = [
      {
        role: 'system',
        content: `당신은 공공기관 문서 분석 전문 AI입니다.${body.docType ? ` 분석 대상: ${body.docType}` : ''}
분석 결과는 한국어로 작성하며, 공공기관 표준 형식을 준수합니다.
개인정보(이름, 주민번호, 연락처)가 포함된 경우 [개인정보 마스킹]으로 표시합니다.`,
      },
      {
        role: 'user',
        content: `${analysisPrompt}\n\n=== 분석 대상 문서 ===\n${maskedContent}`,
      },
    ];

    // 장문서 처리: 최대 토큰 4096 (모델에 따라 조정)
    const llmResponse = await provider.chat(messages, { maxTokens: 4096, temperature: 0.2 });

    await logAiEvent('DOCUMENT_ANALYZE', actor, 'document', body.tenantId, request.ip,
      request.headers['user-agent'] ?? 'unknown', {
        analysisType: body.analysisType,
        contentLength: body.content.length,
        tokensUsed: llmResponse.tokensUsed,
      });

    await reply.status(200).send({
      success: true,
      data: {
        analysisType: body.analysisType,
        result: maskPII(llmResponse.text),
        model: llmResponse.model,
        tokensUsed: llmResponse.tokensUsed,
        contentLength: body.content.length,
      },
    });
  } catch (err) {
    request.log.error(err, '문서 분석 실패');
    await reply.status(502).send({
      success: false,
      error: { code: 'ANALYZE_FAILED', message: '문서 분석 중 오류가 발생했습니다.' },
    });
  }
}

// ── 문서 비교 분석 ────────────────────────────────────────────────────────

const compareSchema = z.object({
  tenantId: z.string().uuid(),
  grade: z.enum(['O']),
  documentA: z.string().min(1).max(150_000),
  documentB: z.string().min(1).max(150_000),
  compareAspects: z.array(z.string()).max(10).optional(),
  modelId: z.string().optional(),
});

type CompareBody = z.infer<typeof compareSchema>;

export async function documentCompareHandler(
  request: FastifyRequest<{ Body: CompareBody }>,
  reply: FastifyReply,
): Promise<void> {
  const body = compareSchema.parse(request.body);
  const actor = (request.headers['x-user-id'] as string) || 'system';

  // N2SF N-05: C/S등급 차단
  try {
    validateDataGrade(body.grade as DataGrade);
  } catch (error) {
    if (error instanceof DataGradeViolationError) {
      await logAiEvent('AI_GRADE_VIOLATION', actor, 'document', body.tenantId, request.ip,
        request.headers['user-agent'] ?? 'unknown', { grade: body.grade, blocked: true, endpoint: 'document/compare' });
      await reply.status(403).send({ success: false, error: { code: error.code, message: error.message } });
      return;
    }
    throw error;
  }

  try {
    let llmConfig = getLLMConfig();
    if (body.modelId) {
      const model = await prisma.aiModel.findUnique({ where: { id: body.modelId } });
      if (model?.isActive) {
        llmConfig = buildLLMConfig({ provider: model.provider, endpoint: model.endpoint, name: model.name, config: model.config });
      }
    }

    const provider = await createLLMProvider(llmConfig);
    const aspects = body.compareAspects?.join(', ') ?? '목적, 주요 내용, 차이점, 공통점, 개선 사항';

    const messages: LLMMessage[] = [
      {
        role: 'system',
        content: '두 공공문서를 비교 분석하는 전문 AI입니다. 객관적이고 구조화된 비교 분석을 제공합니다.',
      },
      {
        role: 'user',
        content: `다음 두 문서를 비교 분석하세요. 분석 항목: ${aspects}

## 문서 A
${maskPII(body.documentA)}

## 문서 B
${maskPII(body.documentB)}

비교 결과를 표 형식(마크다운)으로 정리하고, 종합 의견을 제시하세요.`,
      },
    ];

    const llmResponse = await provider.chat(messages, { maxTokens: 3000, temperature: 0.2 });

    await logAiEvent('DOCUMENT_COMPARE', actor, 'document', body.tenantId, request.ip,
      request.headers['user-agent'] ?? 'unknown',
      { tokensUsed: llmResponse.tokensUsed, docALength: body.documentA.length, docBLength: body.documentB.length });

    await reply.status(200).send({
      success: true,
      data: {
        comparison: maskPII(llmResponse.text),
        model: llmResponse.model,
        tokensUsed: llmResponse.tokensUsed,
      },
    });
  } catch (err) {
    request.log.error(err, '문서 비교 실패');
    await reply.status(502).send({
      success: false,
      error: { code: 'COMPARE_FAILED', message: '문서 비교 분석 중 오류가 발생했습니다.' },
    });
  }
}
