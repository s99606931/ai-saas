// AI 설명 가능성 & 투명성 (XAI) — FR-ADV22.1~22.6
// Design Ref: SVC-AI-ADV-R22 DESIGN §1~§5
// Plan SC: SC-1 (추론 체인), SC-2 (근거 링크), SC-3 (신뢰도), SC-4 (반사실), SC-5 (편향)
// CSAP: D-06 판단 근거 감사 로그, D-12 AI 시스템 설명 문서
// N2SF: N-05 O등급 데이터만 처리

import { maskPII } from './pii-masking.js';

// ── 타입 정의 ────────────────────────────────────────────────────────────────

/** 추론 단계 유형 */
export type ReasoningStepType = 'retrieval' | 'analysis' | 'generation' | 'validation' | 'filtering';

/** 추론 단계 — Design §1 */
export interface ReasoningStep {
  stepId: string;
  type: ReasoningStepType;
  description: string;
  input: string;
  output: string;
  durationMs: number;
  metadata?: Record<string, unknown>;
}

/** 추론 체인 */
export interface ReasoningChain {
  id: string;
  query: string;
  steps: ReasoningStep[];
  totalDurationMs: number;
  createdAt: string;
}

/** 인용 (근거 문서) — Design §2 */
export interface Citation {
  id: string;
  sourceId: string;
  sourceType: 'regulation' | 'document' | 'faq' | 'policy' | 'manual';
  title: string;
  section?: string;
  quote: string;
  relevanceScore: number;
  url?: string;
}

/** 신뢰도 점수 — Design §3 */
export interface ConfidenceScore {
  /** 전체 신뢰도 (0~1) */
  overall: number;
  /** 차원별 신뢰도 */
  dimensions: {
    /** 사실적 정확성 신뢰도 */
    factual: number;
    /** 컨텍스트 일치 신뢰도 */
    contextual: number;
    /** 언어적 품질 신뢰도 */
    linguistic: number;
  };
  /** 신뢰도 수준 */
  level: 'high' | 'medium' | 'low';
}

/** 반사실 설명 — Design §4 */
export interface CounterfactualExplanation {
  id: string;
  condition: string;
  alternativeResult: string;
  confidence: number;
}

/** 편향 탐지 결과 — Design §5 */
export interface BiasDetectionResult {
  dimension: string;
  biasScore: number;
  isSignificant: boolean;
  details: string;
  recommendation?: string;
}

/** 설명 가능성 보고서 */
export interface ExplainabilityReport {
  id: string;
  query: string;
  response: string;
  reasoningChain: ReasoningChain;
  citations: Citation[];
  confidence: ConfidenceScore;
  counterfactuals: CounterfactualExplanation[];
  biasResults: BiasDetectionResult[];
  createdAt: string;
}

// ── 추론 체인 추적기 — Design §1 ───────────────────────────────────────────

/** 추론 체인 수집기 */
export class ReasoningTracer {
  private steps: ReasoningStep[] = [];
  private readonly startTime: number;

  constructor() {
    this.startTime = Date.now();
  }

  /** 추론 단계 추가 */
  addStep(
    type: ReasoningStepType,
    description: string,
    input: string,
    output: string,
    durationMs: number,
    metadata?: Record<string, unknown>,
  ): void {
    this.steps.push({
      stepId: `step-${this.steps.length + 1}`,
      type,
      description,
      input: maskPII(input),
      output: maskPII(output),
      durationMs,
      metadata,
    });
  }

  /** 추론 체인 완성 */
  buildChain(query: string): ReasoningChain {
    return {
      id: `chain-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      query: maskPII(query),
      steps: [...this.steps],
      totalDurationMs: Date.now() - this.startTime,
      createdAt: new Date().toISOString(),
    };
  }

  /** 단계 수 */
  get stepCount(): number {
    return this.steps.length;
  }

  /** 초기화 */
  reset(): void {
    this.steps = [];
  }
}

// ── 근거 문서 링크 — Design §2 ─────────────────────────────────────────────

/**
 * 응답에 인라인 각주 삽입
 * "응답 텍스트 [1][2]" + 출처 목록 형식
 */
export function addCitations(response: string, citations: Citation[]): string {
  if (citations.length === 0) return response;

  // 관련성 높은 순 정렬
  const sorted = [...citations].sort((a, b) => b.relevanceScore - a.relevanceScore);

  // 인라인 각주 추가 (문장 끝에)
  let annotatedResponse = response;
  const usedCitations: Citation[] = [];

  for (const citation of sorted.slice(0, 5)) {
    // 인용 키워드가 응답에 포함되어 있으면 각주 삽입
    const keywords = citation.title.split(/\s+/).filter((w) => w.length > 1);
    for (const keyword of keywords) {
      if (annotatedResponse.includes(keyword) && !usedCitations.includes(citation)) {
        const idx = usedCitations.length + 1;
        const insertPos = annotatedResponse.indexOf(keyword) + keyword.length;
        annotatedResponse = annotatedResponse.slice(0, insertPos) +
          ` [${idx}]` +
          annotatedResponse.slice(insertPos);
        usedCitations.push(citation);
        break;
      }
    }
  }

  // 출처 목록 추가
  if (usedCitations.length > 0) {
    annotatedResponse += '\n\n--- 출처 ---';
    for (let i = 0; i < usedCitations.length; i++) {
      const c = usedCitations[i];
      if (!c) continue;
      const section = c.section ? ` ${c.section}` : '';
      annotatedResponse += `\n[${i + 1}] ${c.title}${section}`;
      if (c.url) {
        annotatedResponse += ` (${c.url})`;
      }
    }
  }

  return annotatedResponse;
}

// ── 신뢰도 계산 — Design §3 ────────────────────────────────────────────────

/**
 * 신뢰도 점수 계산
 *
 * @param contextMatchRatio - 응답이 컨텍스트에서 뒷받침되는 비율 (0~1)
 * @param sourceAuthority - 출처의 권위 점수 평균 (0~1)
 * @param responseCoherence - 응답의 내적 일관성 (0~1)
 */
export function calculateConfidence(
  contextMatchRatio: number,
  sourceAuthority: number,
  responseCoherence: number,
): ConfidenceScore {
  const factual = contextMatchRatio;
  const contextual = sourceAuthority;
  const linguistic = responseCoherence;

  // 가중 평균
  const overall = factual * 0.4 + contextual * 0.35 + linguistic * 0.25;

  let level: 'high' | 'medium' | 'low';
  if (overall >= 0.8) {
    level = 'high';
  } else if (overall >= 0.5) {
    level = 'medium';
  } else {
    level = 'low';
  }

  return {
    overall: Math.round(overall * 1000) / 1000,
    dimensions: {
      factual: Math.round(factual * 1000) / 1000,
      contextual: Math.round(contextual * 1000) / 1000,
      linguistic: Math.round(linguistic * 1000) / 1000,
    },
    level,
  };
}

// ── 반사실 설명 — Design §4 ────────────────────────────────────────────────

/**
 * 반사실 설명 생성 (규칙 기반)
 * "만약 X였다면 Y"
 */
export function generateCounterfactuals(
  query: string,
  response: string,
  contexts: string[],
): CounterfactualExplanation[] {
  const counterfactuals: CounterfactualExplanation[] = [];

  // 날짜 기반 반사실
  const dateMatch = query.match(/(\d{4})년/);
  if (dateMatch) {
    const year = dateMatch[1];
    const prevYear = String(Number(year) - 1);
    counterfactuals.push({
      id: `cf-date-${Date.now()}`,
      condition: `질문이 ${prevYear}년에 대한 것이었다면`,
      alternativeResult: `${prevYear}년 기준의 다른 규정/절차가 적용될 수 있습니다`,
      confidence: 0.7,
    });
  }

  // 컨텍스트 부재 반사실
  if (contexts.length > 0) {
    counterfactuals.push({
      id: `cf-nocontext-${Date.now()}`,
      condition: '관련 법령/규정 컨텍스트 없이 질문했다면',
      alternativeResult: '일반적인 상식 기반 응답만 가능하며, 법적 근거가 부족할 수 있습니다',
      confidence: 0.85,
    });
  }

  // 응답 길이 기반 반사실
  if (response.length > 500) {
    counterfactuals.push({
      id: `cf-length-${Date.now()}`,
      condition: '더 간단한 질문이었다면',
      alternativeResult: '더 짧고 핵심적인 답변이 제공되었을 것입니다',
      confidence: 0.5,
    });
  }

  // 키워드 변경 반사실
  const keyTerms = ['신청', '변경', '취소', '발급', '등록'];
  for (const term of keyTerms) {
    if (query.includes(term)) {
      const alternatives = keyTerms.filter((t) => t !== term);
      const alt = alternatives[0];
      if (alt) {
        counterfactuals.push({
          id: `cf-term-${Date.now()}`,
          condition: `"${term}" 대신 "${alt}"에 대한 질문이었다면`,
          alternativeResult: `${alt} 절차에 해당하는 다른 요건과 서류가 필요합니다`,
          confidence: 0.6,
        });
        break;
      }
    }
  }

  return counterfactuals;
}

// ── 편향 탐지 — Design §5 ──────────────────────────────────────────────────

/** 편향 모니터링 차원 */
export const BIAS_DIMENSIONS = ['gender', 'age', 'region', 'case_type'] as const;

/**
 * 응답 편향 탐지 (규칙 기반)
 * 특정 인구통계 그룹에 대한 차별적 표현 검사
 */
export function detectBias(response: string): BiasDetectionResult[] {
  const results: BiasDetectionResult[] = [];

  // 성별 편향: 성별 특정 표현 빈도 비교
  const maleTerms = ['남성', '남자', '아버지', '아들', '형'];
  const femaleTerms = ['여성', '여자', '어머니', '딸', '언니'];
  const maleCount = maleTerms.reduce((sum, t) => sum + countOccurrences(response, t), 0);
  const femaleCount = femaleTerms.reduce((sum, t) => sum + countOccurrences(response, t), 0);
  const genderTotal = maleCount + femaleCount;
  const genderBias = genderTotal > 0
    ? Math.abs(maleCount - femaleCount) / genderTotal
    : 0;

  results.push({
    dimension: 'gender',
    biasScore: Math.round(genderBias * 1000) / 1000,
    isSignificant: genderBias > 0.3,
    details: `남성 표현 ${maleCount}회, 여성 표현 ${femaleCount}회`,
    recommendation: genderBias > 0.3
      ? '성별 중립적 표현 사용을 권장합니다'
      : undefined,
  });

  // 지역 편향: 수도권 vs 비수도권
  const seoulTerms = ['서울', '경기', '인천', '수도권'];
  const otherTerms = ['지방', '지역', '도시', '농촌'];
  const seoulCount = seoulTerms.reduce((sum, t) => sum + countOccurrences(response, t), 0);
  const otherCount = otherTerms.reduce((sum, t) => sum + countOccurrences(response, t), 0);
  const regionTotal = seoulCount + otherCount;
  const regionBias = regionTotal > 0
    ? Math.abs(seoulCount - otherCount) / regionTotal
    : 0;

  results.push({
    dimension: 'region',
    biasScore: Math.round(regionBias * 1000) / 1000,
    isSignificant: regionBias > 0.3,
    details: `수도권 표현 ${seoulCount}회, 비수도권 표현 ${otherCount}회`,
    recommendation: regionBias > 0.3
      ? '지역 편향 없는 균형잡힌 설명을 권장합니다'
      : undefined,
  });

  return results;
}

// ── 통합 설명 보고서 생성 ──────────────────────────────────────────────────

/**
 * 설명 가능성 보고서 생성
 */
export function generateExplainabilityReport(
  query: string,
  response: string,
  reasoningChain: ReasoningChain,
  citations: Citation[],
  contextMatchRatio: number,
  sourceAuthority: number,
  contexts: string[],
): ExplainabilityReport {
  const confidence = calculateConfidence(
    contextMatchRatio,
    sourceAuthority,
    estimateCoherence(response),
  );

  const counterfactuals = generateCounterfactuals(query, response, contexts);
  const biasResults = detectBias(response);

  return {
    id: `xai-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    query: maskPII(query),
    response: maskPII(response),
    reasoningChain,
    citations,
    confidence,
    counterfactuals,
    biasResults,
    createdAt: new Date().toISOString(),
  };
}

// ── 유틸리티 ────────────────────────────────────────────────────────────────

/** 텍스트 내 단어 출현 횟수 */
function countOccurrences(text: string, word: string): number {
  let count = 0;
  let pos = 0;
  while (true) {
    const found = text.indexOf(word, pos);
    if (found === -1) break;
    count++;
    pos = found + word.length;
  }
  return count;
}

/**
 * 응답 일관성 추정 (간이)
 * 문장 길이 분산, 반복 단어 비율 등으로 추정
 */
function estimateCoherence(text: string): number {
  const sentences = text.split(/[.!?。]\s*/).filter((s) => s.trim().length > 0);
  if (sentences.length <= 1) return 0.7;

  // 문장 길이 분산 (낮을수록 일관성 높음)
  const lengths = sentences.map((s) => s.length);
  const avgLen = lengths.reduce((s, l) => s + l, 0) / lengths.length;
  const variance = lengths.reduce((s, l) => s + (l - avgLen) ** 2, 0) / lengths.length;
  const cv = Math.sqrt(variance) / Math.max(avgLen, 1);

  // CV가 낮으면 일관성 높음
  const coherence = Math.max(0, Math.min(1, 1 - cv * 0.5));
  return Math.round(coherence * 1000) / 1000;
}
