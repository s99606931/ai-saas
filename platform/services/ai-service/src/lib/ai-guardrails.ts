// AI 가드레일 통합 파이프라인 -- FR-ADV3.4, FR-ADV3.5
// Design Ref: SVC-AI-ADV-R3 DESIGN §4, §5
// 입력 가드레일 → AI 처리 → 출력 가드레일 전체 파이프라인
// CSAP: D-12 시스템 개발 보안, D-09 암호화

import { detectInjectionRuleBased, detectInjectionLLM } from './prompt-injection-detector.js';
import type { InjectionDetectionResult } from './prompt-injection-detector.js';
import { filterContent } from './content-filter.js';
import type { ContentFilterResult } from './content-filter.js';
import { detectHallucination } from './hallucination-detector.js';
import type { HallucinationCheckResult } from './hallucination-detector.js';
import { maskPII } from './pii-masking.js';

// ── 타입 정의 ──────────────────────────────────────────────────────────────

export interface GuardrailViolation {
  /** 위반 유형 */
  type: 'injection' | 'content' | 'hallucination' | 'pii_leak' | 'policy';
  /** 심각도 */
  severity: 'low' | 'medium' | 'high' | 'critical';
  /** 설명 */
  description: string;
  /** 상세 데이터 */
  details?: Record<string, unknown>;
}

export interface GuardrailResult {
  /** 전체 통과 여부 */
  passed: boolean;
  /** 위반 목록 */
  violations: GuardrailViolation[];
  /** 정화된 콘텐츠 (출력 가드레일 통과 시) */
  sanitizedContent?: string;
  /** 처리 시간 */
  metadata: {
    inputCheckMs: number;
    outputCheckMs: number;
    totalCheckMs: number;
  };
}

export interface GuardrailOptions {
  /** LLM 기반 프롬프트 주입 검증 활성화 (기본: false, 규칙 기반만) */
  enableLLMInjectionCheck?: boolean;
  /** 환각 감지 활성화 (기본: false, RAG 전용) */
  enableHallucinationCheck?: boolean;
  /** 환각 감지용 출처 텍스트 */
  sourceTexts?: string[];
  /** 원본 질문 (환각 감지용) */
  originalQuestion?: string;
}

// ── PII 누출 검사 ──────────────────────────────────────────────────────────

/**
 * 출력 PII 누출 검사
 * Plan SC: FR-ADV3.4
 *
 * AI 출력에 마스킹되지 않은 PII가 포함되었는지 검사
 */
const PII_PATTERNS: Array<{ pattern: RegExp; type: string }> = [
  { pattern: /\d{6}[- ]?\d{7}/, type: '주민등록번호' },
  { pattern: /\d{3}[- ]?\d{3,4}[- ]?\d{4}/, type: '전화번호' },
  { pattern: /\d{4}[- ]?\d{4}[- ]?\d{4}[- ]?\d{4}/, type: '카드번호' },
  { pattern: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/, type: '이메일' },
  {
    pattern: /(?:서울|부산|대구|인천|광주|대전|울산|세종|경기|강원|충북|충남|전북|전남|경북|경남|제주)\s*(?:시|도)?\s*.+(?:구|군|시)\s*.+(?:동|읍|면)\s*\d+/,
    type: '상세주소',
  },
];

function checkPIILeak(text: string): GuardrailViolation[] {
  const violations: GuardrailViolation[] = [];

  for (const { pattern, type } of PII_PATTERNS) {
    if (pattern.test(text)) {
      violations.push({
        type: 'pii_leak',
        severity: 'high',
        description: `출력에 마스킹되지 않은 ${type} 감지`,
        details: { piiType: type },
      });
    }
  }

  return violations;
}

// ── 입력 가드레일 ──────────────────────────────────────────────────────────

/**
 * 입력 가드레일: 프롬프트 주입 + 콘텐츠 필터 + 데이터 등급 검증
 * Plan SC: FR-ADV3.5
 *
 * @param input 사용자 입력
 * @param options 가드레일 옵션
 */
export async function checkInput(
  input: string,
  options: GuardrailOptions = {},
): Promise<GuardrailResult> {
  const startTime = performance.now();
  const violations: GuardrailViolation[] = [];

  // 1. 프롬프트 주입 탐지
  let injectionResult: InjectionDetectionResult;
  if (options.enableLLMInjectionCheck) {
    injectionResult = await detectInjectionLLM(input);
  } else {
    injectionResult = detectInjectionRuleBased(input);
  }

  if (injectionResult.isInjection) {
    violations.push({
      type: 'injection',
      severity: 'critical',
      description: `프롬프트 주입 공격 탐지 (확신도: ${(injectionResult.confidence * 100).toFixed(0)}%)`,
      details: {
        patterns: injectionResult.detectedPatterns,
        confidence: injectionResult.confidence,
        llmVerified: injectionResult.llmVerified,
      },
    });
  }

  // 2. 콘텐츠 필터
  const contentResult: ContentFilterResult = filterContent(input);
  if (contentResult.blocked) {
    for (const violation of contentResult.violations) {
      violations.push({
        type: 'content',
        severity: violation.riskLevel === 'critical' ? 'critical' : 'high',
        description: `부적절 콘텐츠: ${violation.description} (${violation.matchedTerm})`,
        details: { category: violation.category, riskLevel: violation.riskLevel },
      });
    }
  }

  const inputCheckMs = performance.now() - startTime;
  const passed = violations.length === 0;

  return {
    passed,
    violations,
    sanitizedContent: passed ? input : undefined,
    metadata: {
      inputCheckMs,
      outputCheckMs: 0,
      totalCheckMs: inputCheckMs,
    },
  };
}

// ── 출력 가드레일 ──────────────────────────────────────────────────────────

/**
 * 출력 가드레일: PII 누출 + 콘텐츠 필터 + 환각 감지
 * Plan SC: FR-ADV3.4, FR-ADV3.5
 *
 * @param output AI 출력
 * @param options 가드레일 옵션
 */
export async function checkOutput(
  output: string,
  options: GuardrailOptions = {},
): Promise<GuardrailResult> {
  const startTime = performance.now();
  const violations: GuardrailViolation[] = [];

  // 1. PII 누출 검사
  const piiViolations = checkPIILeak(output);
  violations.push(...piiViolations);

  // 2. 콘텐츠 필터 (출력)
  const contentResult = filterContent(output);
  if (contentResult.blocked) {
    for (const violation of contentResult.violations) {
      violations.push({
        type: 'content',
        severity: violation.riskLevel === 'critical' ? 'critical' : 'high',
        description: `출력 부적절 콘텐츠: ${violation.description}`,
        details: { category: violation.category },
      });
    }
  }

  // 3. 환각 감지 (선택적, RAG 전용)
  if (
    options.enableHallucinationCheck &&
    options.sourceTexts &&
    options.sourceTexts.length > 0 &&
    options.originalQuestion
  ) {
    const halluResult: HallucinationCheckResult = await detectHallucination(
      output,
      options.sourceTexts,
      options.originalQuestion,
    );

    if (halluResult.hasHallucination) {
      violations.push({
        type: 'hallucination',
        severity: halluResult.riskLevel === 'danger' ? 'high' : 'medium',
        description: `환각 감지: 환각률 ${(halluResult.hallucinationRate * 100).toFixed(0)}% (${halluResult.ungroundedClaims.length}개 근거 없는 주장)`,
        details: {
          hallucinationRate: halluResult.hallucinationRate,
          ungroundedClaims: halluResult.ungroundedClaims,
          totalClaims: halluResult.totalClaims,
          groundedClaims: halluResult.groundedClaims,
        },
      });
    }
  }

  const outputCheckMs = performance.now() - startTime;
  const passed = violations.filter((v) => v.severity === 'critical' || v.severity === 'high').length === 0;

  // PII가 감지된 경우 마스킹 적용
  const sanitizedContent = passed
    ? maskPII(output) // 추가 안전장치로 PII 마스킹
    : undefined;

  return {
    passed,
    violations,
    sanitizedContent,
    metadata: {
      inputCheckMs: 0,
      outputCheckMs,
      totalCheckMs: outputCheckMs,
    },
  };
}

// ── 통합 가드레일 파이프라인 ────────────────────────────────────────────────

/**
 * 전체 가드레일 파이프라인: 입력 검증 → AI 처리 함수 → 출력 검증
 * Plan SC: FR-ADV3.5
 *
 * @param input 사용자 입력
 * @param processFn AI 처리 함수 (입력 → 출력)
 * @param options 가드레일 옵션
 */
export async function runWithGuardrails<T extends { answer: string; sources?: Array<{ excerpt: string }> }>(
  input: string,
  processFn: (sanitizedInput: string) => Promise<T>,
  options: GuardrailOptions = {},
): Promise<{ result?: T; guardrail: GuardrailResult }> {
  const totalStart = performance.now();

  // 1. 입력 가드레일
  const inputCheck = await checkInput(input, options);

  if (!inputCheck.passed) {
    return {
      guardrail: {
        ...inputCheck,
        metadata: {
          ...inputCheck.metadata,
          totalCheckMs: performance.now() - totalStart,
        },
      },
    };
  }

  // 2. AI 처리
  const result = await processFn(inputCheck.sanitizedContent ?? input);

  // 3. 출력 가드레일
  const outputOptions: GuardrailOptions = {
    ...options,
    sourceTexts: options.sourceTexts ?? result.sources?.map((s) => s.excerpt) ?? [],
    originalQuestion: options.originalQuestion ?? input,
  };

  const outputCheck = await checkOutput(result.answer, outputOptions);

  // 결과 합산
  const allViolations = [...inputCheck.violations, ...outputCheck.violations];
  const totalCheckMs = performance.now() - totalStart;

  return {
    result: outputCheck.passed ? result : undefined,
    guardrail: {
      passed: outputCheck.passed,
      violations: allViolations,
      sanitizedContent: outputCheck.sanitizedContent,
      metadata: {
        inputCheckMs: inputCheck.metadata.inputCheckMs,
        outputCheckMs: outputCheck.metadata.outputCheckMs,
        totalCheckMs,
      },
    },
  };
}
