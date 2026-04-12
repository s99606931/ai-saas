// 공공 AI API 핸들러 — MTU-N536~N540
// Design Ref: SVC-AI-PUBLIC DESIGN §1~§5
// Plan SC: FR-AI-PUB.1~FR-AI-PUB.5
// CSAP: D-08 인증, D-12 입력 검증, D-06 감사 로그
// N2SF: O등급 데이터만 처리, PII 마스킹 필수

import type { FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { logAiEvent } from '../lib/audit.js';
import { validateDataGrade, DataGradeViolationError } from '../lib/grade-check.js';
import { maskPII } from '../lib/pii-masking.js';
import type { DataGrade } from '@public-saas/types';

async function checkGrade(
  grade: DataGrade,
  actor: string,
  tenantId: string,
  endpoint: string,
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<boolean> {
  try {
    validateDataGrade(grade);
    return true;
  } catch (error) {
    if (error instanceof DataGradeViolationError) {
      await logAiEvent('AI_GRADE_VIOLATION', actor, 'public-ai', tenantId, request.ip,
        request.headers['user-agent'] ?? 'unknown', { grade, blocked: true, endpoint });
      await reply.status(403).send({ success: false, error: { code: error.code, message: error.message } });
      return false;
    }
    throw error;
  }
}

// ── 1. POST /ai/public/citizen/classify ───────────────────────────────────
const citizenClassifySchema = z.object({
  tenantId: z.string().uuid(),
  grade: z.enum(['O']),
  text: z.string().min(1).max(4000),
  language: z.enum(['ko', 'en']).default('ko'),
});

type CitizenClassifyBody = z.infer<typeof citizenClassifySchema>;

export async function citizenClassifyHandler(
  request: FastifyRequest<{ Body: CitizenClassifyBody }>,
  reply: FastifyReply,
): Promise<void> {
  const body = citizenClassifySchema.parse(request.body);
  const actor = (request.headers['x-user-id'] as string) || 'system';

  if (!(await checkGrade(body.grade as DataGrade, actor, body.tenantId, 'public/citizen/classify', request, reply))) return;

  const masked = maskPII(body.text);

  // 실제 구현에서는 LLM 분류 서비스 호출
  const classification = {
    category: '일반민원',
    subCategory: '문의',
    priority: 'normal' as const,
    confidence: 0.85,
    suggestedDepartment: '민원봉사실',
    requiresHuman: false,
  };

  await logAiEvent('CITIZEN_CLASSIFY', actor, 'public-ai', body.tenantId, request.ip,
    request.headers['user-agent'] ?? 'unknown', {
      length: body.text.length,
      language: body.language,
      category: classification.category,
      maskedSample: masked.slice(0, 80),
    });

  await reply.send({ success: true, data: classification });
}

// ── 2. POST /ai/public/regulation/interpret ───────────────────────────────
const regulationInterpretSchema = z.object({
  tenantId: z.string().uuid(),
  grade: z.enum(['O']),
  lawId: z.string().min(1).max(100),
  question: z.string().min(1).max(2000),
});

type RegulationInterpretBody = z.infer<typeof regulationInterpretSchema>;

export async function regulationInterpretHandler(
  request: FastifyRequest<{ Body: RegulationInterpretBody }>,
  reply: FastifyReply,
): Promise<void> {
  const body = regulationInterpretSchema.parse(request.body);
  const actor = (request.headers['x-user-id'] as string) || 'system';

  if (!(await checkGrade(body.grade as DataGrade, actor, body.tenantId, 'public/regulation/interpret', request, reply))) return;

  const interpretation = {
    lawId: body.lawId,
    question: body.question,
    answer: '해당 법령 조항에 따르면 ...(LLM 생성 응답)',
    citations: [{ article: '제1조', text: '본 법은 ...' }],
    disclaimer: '본 응답은 참고용입니다. 최종 해석은 법률 전문가와 상담하십시오.',
    confidence: 0.78,
  };

  await logAiEvent('REGULATION_INTERPRET', actor, body.lawId, body.tenantId, request.ip,
    request.headers['user-agent'] ?? 'unknown', { lawId: body.lawId, questionLength: body.question.length });

  await reply.send({ success: true, data: interpretation });
}

// ── 3. POST /ai/public/document/ocr ───────────────────────────────────────
const documentOcrSchema = z.object({
  tenantId: z.string().uuid(),
  grade: z.enum(['O']),
  imageBase64: z.string().min(1).max(10_000_000),
  language: z.enum(['ko', 'en', 'auto']).default('auto'),
  enableTableExtraction: z.boolean().default(false),
});

type DocumentOcrBody = z.infer<typeof documentOcrSchema>;

export async function documentOcrHandler(
  request: FastifyRequest<{ Body: DocumentOcrBody }>,
  reply: FastifyReply,
): Promise<void> {
  const body = documentOcrSchema.parse(request.body);
  const actor = (request.headers['x-user-id'] as string) || 'system';

  if (!(await checkGrade(body.grade as DataGrade, actor, body.tenantId, 'public/document/ocr', request, reply))) return;

  const ocrResult = {
    text: '인식된 행정문서 텍스트...',
    confidence: 0.92,
    language: body.language === 'auto' ? 'ko' : body.language,
    tables: body.enableTableExtraction ? [] : undefined,
    pageCount: 1,
  };

  await logAiEvent('DOCUMENT_OCR', actor, 'public-ai', body.tenantId, request.ip,
    request.headers['user-agent'] ?? 'unknown', {
      imageSize: body.imageBase64.length,
      language: body.language,
      confidence: ocrResult.confidence,
    });

  await reply.send({ success: true, data: ocrResult });
}

// ── 4. POST /ai/public/survey/generate ────────────────────────────────────
const surveyGenerateSchema = z.object({
  tenantId: z.string().uuid(),
  grade: z.enum(['O']),
  topic: z.string().min(1).max(500),
  targetAudience: z.string().min(1).max(200),
  questionCount: z.number().int().min(3).max(30).default(10),
  includeOpenEnded: z.boolean().default(true),
});

type SurveyGenerateBody = z.infer<typeof surveyGenerateSchema>;

export async function surveyGenerateHandler(
  request: FastifyRequest<{ Body: SurveyGenerateBody }>,
  reply: FastifyReply,
): Promise<void> {
  const body = surveyGenerateSchema.parse(request.body);
  const actor = (request.headers['x-user-id'] as string) || 'system';

  if (!(await checkGrade(body.grade as DataGrade, actor, body.tenantId, 'public/survey/generate', request, reply))) return;

  const survey = {
    title: `[설문] ${body.topic}`,
    description: `${body.targetAudience} 대상 설문조사`,
    questions: Array.from({ length: body.questionCount }, (_, i) => ({
      id: `q${i + 1}`,
      type: i < body.questionCount - 2 ? 'multiple_choice' : body.includeOpenEnded ? 'open_ended' : 'multiple_choice',
      text: `질문 ${i + 1}`,
      required: true,
      options: i < body.questionCount - 2 ? ['매우 그렇다', '그렇다', '보통', '아니다', '매우 아니다'] : undefined,
    })),
  };

  await logAiEvent('SURVEY_GENERATE', actor, 'public-ai', body.tenantId, request.ip,
    request.headers['user-agent'] ?? 'unknown', { topic: body.topic.slice(0, 100), questionCount: body.questionCount });

  await reply.send({ success: true, data: survey });
}

// ── 5. POST /ai/public/budget/analyze ─────────────────────────────────────
const budgetAnalyzeSchema = z.object({
  tenantId: z.string().uuid(),
  grade: z.enum(['O']),
  fiscalYear: z.number().int().min(2020).max(2050),
  department: z.string().min(1).max(200),
  budgetData: z.array(z.object({
    category: z.string().max(100),
    allocated: z.number().nonnegative(),
    spent: z.number().nonnegative(),
  })).min(1).max(500),
});

type BudgetAnalyzeBody = z.infer<typeof budgetAnalyzeSchema>;

export async function budgetAnalyzeHandler(
  request: FastifyRequest<{ Body: BudgetAnalyzeBody }>,
  reply: FastifyReply,
): Promise<void> {
  const body = budgetAnalyzeSchema.parse(request.body);
  const actor = (request.headers['x-user-id'] as string) || 'system';

  if (!(await checkGrade(body.grade as DataGrade, actor, body.tenantId, 'public/budget/analyze', request, reply))) return;

  const totalAllocated = body.budgetData.reduce((s, b) => s + b.allocated, 0);
  const totalSpent = body.budgetData.reduce((s, b) => s + b.spent, 0);
  const executionRate = totalAllocated > 0 ? totalSpent / totalAllocated : 0;

  const analysis = {
    fiscalYear: body.fiscalYear,
    department: body.department,
    totalAllocated,
    totalSpent,
    executionRate,
    riskLevel: executionRate < 0.5 ? 'high' : executionRate < 0.8 ? 'medium' : 'low',
    recommendations: [
      executionRate < 0.5 ? '집행 부진 항목 점검 필요' : '정상 집행 중',
    ],
  };

  await logAiEvent('BUDGET_ANALYZE', actor, 'public-ai', body.tenantId, request.ip,
    request.headers['user-agent'] ?? 'unknown', {
      fiscalYear: body.fiscalYear,
      department: body.department,
      itemCount: body.budgetData.length,
      executionRate,
    });

  await reply.send({ success: true, data: analysis });
}
