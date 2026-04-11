// 환각(Hallucination) 감지기 -- FR-ADV3.3
// Design Ref: SVC-AI-ADV-R3 DESIGN §3
// RAG 답변과 검색 출처 비교, 출처 없는 사실 주장 탐지
// CSAP: D-12 시스템 개발 보안

import { getLLMConfig, createLLMProvider } from './llm-provider.js';
import { maskPII } from './pii-masking.js';
import type { LLMMessage } from './llm-provider.js';

// ── 타입 정의 ──────────────────────────────────────────────────────────────

export interface HallucinationCheckResult {
  /** 환각 감지 여부 */
  hasHallucination: boolean;
  /** 환각률 (0~1, 근거 없는 주장 비율) */
  hallucinationRate: number;
  /** 총 주장 수 */
  totalClaims: number;
  /** 근거 있는 주장 수 */
  groundedClaims: number;
  /** 근거 없는 주장 목록 */
  ungroundedClaims: string[];
  /** 환각 위험 수준 */
  riskLevel: 'safe' | 'warning' | 'danger';
}

// ── 환각 감지 프롬프트 ────────────────────────────────────────────────────

const HALLUCINATION_CHECK_SYSTEM = `당신은 사실 검증 전문가입니다.
AI 답변의 각 주장이 제공된 출처 문서에 근거가 있는지 검증합니다.

검증 기준:
1. 출처 문서에 명시적으로 언급된 정보 → "근거 있음"
2. 출처 문서에서 합리적으로 추론 가능한 정보 → "근거 있음"
3. 출처 문서에 전혀 없는 정보 → "근거 없음 (환각)"
4. 일반 상식/인사말 → "검증 불필요"

반드시 아래 JSON 형식으로만 응답하세요:
{
  "claims": [
    {"text": "주장 내용", "grounded": true, "source": "근거 문서 위치"},
    {"text": "주장 내용", "grounded": false, "reason": "출처에 없는 이유"}
  ]
}`;

// ── 환각 감지 함수 ────────────────────────────────────────────────────────

/**
 * RAG 답변의 환각 감지
 * Plan SC: FR-ADV3.3
 *
 * AI 답변의 각 핵심 주장이 검색된 출처 문서에 근거가 있는지 LLM으로 검증합니다.
 * 환각률(ungrounded/total) > 30% → 경고, > 50% → 위험
 *
 * @param answer AI가 생성한 답변
 * @param sourceTexts 검색된 출처 문서 텍스트 배열
 * @param question 원본 사용자 질문
 */
export async function detectHallucination(
  answer: string,
  sourceTexts: string[],
  question: string,
): Promise<HallucinationCheckResult> {
  // 출처가 없으면 전체가 환각 가능성
  if (sourceTexts.length === 0) {
    return {
      hasHallucination: true,
      hallucinationRate: 1.0,
      totalClaims: 1,
      groundedClaims: 0,
      ungroundedClaims: ['출처 문서가 제공되지 않아 검증 불가'],
      riskLevel: 'danger',
    };
  }

  const maskedAnswer = maskPII(answer);
  const maskedQuestion = maskPII(question);
  const maskedSources = sourceTexts.map((s) => maskPII(s.slice(0, 1500))).join('\n---\n');

  try {
    const llmConfig = getLLMConfig();
    const provider = await createLLMProvider(llmConfig);

    const messages: LLMMessage[] = [
      { role: 'system', content: HALLUCINATION_CHECK_SYSTEM },
      {
        role: 'user',
        content: `## 질문\n${maskedQuestion}\n\n## AI 답변\n${maskedAnswer}\n\n## 출처 문서\n${maskedSources}`,
      },
    ];

    const response = await provider.chat(messages, { maxTokens: 1024, temperature: 0.1 });

    const jsonMatch = /\{[\s\S]*\}/.exec(response.text);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]) as Record<string, unknown>;
      const claims = parsed['claims'];

      if (Array.isArray(claims)) {
        const typedClaims = claims as Array<Record<string, unknown>>;
        const totalClaims = typedClaims.length;
        const groundedClaims = typedClaims.filter((c) => c['grounded'] === true).length;
        const ungroundedClaims = typedClaims
          .filter((c) => c['grounded'] === false)
          .map((c) => String(c['text'] ?? ''));

        const hallucinationRate = totalClaims > 0 ? (totalClaims - groundedClaims) / totalClaims : 0;

        let riskLevel: 'safe' | 'warning' | 'danger';
        if (hallucinationRate > 0.5) {
          riskLevel = 'danger';
        } else if (hallucinationRate > 0.3) {
          riskLevel = 'warning';
        } else {
          riskLevel = 'safe';
        }

        return {
          hasHallucination: hallucinationRate > 0.3,
          hallucinationRate,
          totalClaims,
          groundedClaims,
          ungroundedClaims,
          riskLevel,
        };
      }
    }
  } catch {
    // LLM 실패 시 환각 감지 불가 — 보수적으로 경고
  }

  // 폴백: 간단한 규칙 기반 검사
  return ruleBasedHallucinationCheck(answer, sourceTexts);
}

/**
 * 규칙 기반 환각 검사 (LLM 없이 사용 가능한 폴백)
 *
 * 전략:
 * 1. 답변에서 숫자/법령번호 추출
 * 2. 출처에서 동일 숫자/법령번호 존재 여부 확인
 * 3. 매칭 비율로 환각률 추정
 */
function ruleBasedHallucinationCheck(
  answer: string,
  sourceTexts: string[],
): HallucinationCheckResult {
  const sourceJoined = sourceTexts.join(' ');

  // 답변에서 숫자 패턴 추출 (법령번호, 조항, 금액 등)
  const numberPatterns = answer.match(/\d{2,}/g) ?? [];
  // 답변에서 법령/규정 패턴 추출
  const legalPatterns = answer.match(/제\d+조|제\d+항|제\d+호|법률\s*제\d+호/g) ?? [];

  const allFactoids = [...new Set([...numberPatterns, ...legalPatterns])];

  if (allFactoids.length === 0) {
    return {
      hasHallucination: false,
      hallucinationRate: 0,
      totalClaims: 0,
      groundedClaims: 0,
      ungroundedClaims: [],
      riskLevel: 'safe',
    };
  }

  let grounded = 0;
  const ungrounded: string[] = [];

  for (const factoid of allFactoids) {
    if (sourceJoined.includes(factoid)) {
      grounded++;
    } else {
      ungrounded.push(factoid);
    }
  }

  const total = allFactoids.length;
  const rate = total > 0 ? (total - grounded) / total : 0;

  return {
    hasHallucination: rate > 0.3,
    hallucinationRate: rate,
    totalClaims: total,
    groundedClaims: grounded,
    ungroundedClaims: ungrounded,
    riskLevel: rate > 0.5 ? 'danger' : rate > 0.3 ? 'warning' : 'safe',
  };
}
