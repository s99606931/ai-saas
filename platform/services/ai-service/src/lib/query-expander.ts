// LLM 쿼리 확장기 — FR-ADV1.4
// Design Ref: SVC-AI-ADV-R1 DESIGN §3
// 원본 쿼리를 LLM으로 다양한 관점에서 재작성하여 검색 재현율(recall) 향상
// CSAP: D-12 시스템 개발 보안, N2SF N-05 O등급 PII 마스킹 후 처리

import { getLLMConfig, buildLLMConfig, createLLMProvider } from './llm-provider.js';
import { maskPII } from './pii-masking.js';
import type { LLMMessage } from './llm-provider.js';

// ── 타입 정의 ──────────────────────────────────────────────────────────────

export interface QueryExpansionOptions {
  /** 최대 변형 쿼리 수 (기본 3) */
  maxVariants?: number;
  /** 원본 쿼리 포함 여부 (기본 true, 환각 방어) */
  includeOriginal?: boolean;
  /** LLM 모델 설정 */
  modelConfig?: { provider: string; endpoint: string; name: string; config?: unknown };
}

export interface ExpandedQuery {
  /** 원본 쿼리 */
  original: string;
  /** 확장된 쿼리 변형들 */
  variants: string[];
  /** LLM 확장 근거 */
  reasoning: string;
}

// ── 프롬프트 ───────────────────────────────────────────────────────────────

const EXPANSION_SYSTEM_PROMPT = `당신은 공공기관 문서 검색 전문가입니다.
사용자의 질문을 다양한 관점에서 재작성하여 검색 재현율을 높입니다.

재작성 전략:
1. 동의어 확장: 같은 의미의 다른 용어 사용 (예: "주민등록" → "주민등록증 발급")
2. 개념 확장: 상위/하위 개념 포함 (예: "세금" → "소득세 납부")
3. 관점 전환: 질문의 의도를 다른 방식으로 표현

규칙:
- 원본 질문의 의도를 벗어나지 마세요
- 공공기관/행정 맥락에 맞는 용어를 사용하세요
- 법령명, 기관명은 정확하게 유지하세요

반드시 아래 JSON 형식으로만 응답하세요:
{
  "variants": ["재작성 쿼리 1", "재작성 쿼리 2", "재작성 쿼리 3"],
  "reasoning": "확장 근거 1줄 설명"
}`;

// ── 응답 파싱 ──────────────────────────────────────────────────────────────

interface ExpansionResponse {
  variants: string[];
  reasoning: string;
}

function parseExpansionResponse(text: string): ExpansionResponse | null {
  // JSON 추출 (코드블록 또는 직접)
  const codeBlockMatch = /```(?:json)?\s*\n?([\s\S]*?)\n?```/.exec(text);
  const jsonStr = codeBlockMatch?.[1] ?? text;

  const jsonMatch = /\{[\s\S]*\}/.exec(jsonStr);
  if (!jsonMatch) return null;

  try {
    const parsed = JSON.parse(jsonMatch[0]) as Record<string, unknown>;
    const variants = parsed['variants'];
    if (!Array.isArray(variants)) return null;

    return {
      variants: variants
        .filter((v): v is string => typeof v === 'string' && v.length > 0)
        .map((v) => v.trim()),
      reasoning: String(parsed['reasoning'] ?? ''),
    };
  } catch {
    return null;
  }
}

// ── 메인 함수 ──────────────────────────────────────────────────────────────

/**
 * LLM 쿼리 확장
 * Plan SC: FR-ADV1.4
 *
 * 원본 쿼리를 LLM이 공공기관 맥락에 맞게 다양한 관점으로 재작성합니다.
 * 원본 쿼리는 항상 포함하여 환각 쿼리에 의한 검색 품질 저하를 방지합니다.
 *
 * @param query 원본 사용자 질문
 * @param options 확장 옵션
 */
export async function expandQuery(
  query: string,
  options: QueryExpansionOptions = {},
): Promise<ExpandedQuery> {
  const {
    maxVariants = 3,
    includeOriginal = true,
    modelConfig,
  } = options;

  const maskedQuery = maskPII(query);

  const messages: LLMMessage[] = [
    { role: 'system', content: EXPANSION_SYSTEM_PROMPT },
    {
      role: 'user',
      content: `다음 질문을 ${maxVariants}개의 다른 방식으로 재작성해주세요.\n\n질문: ${maskedQuery}`,
    },
  ];

  const llmConfig = modelConfig ? buildLLMConfig(modelConfig) : getLLMConfig();

  try {
    const provider = await createLLMProvider(llmConfig);
    const response = await provider.chat(messages, { maxTokens: 512, temperature: 0.3 });

    const parsed = parseExpansionResponse(response.text);

    if (parsed && parsed.variants.length > 0) {
      // 최대 변형 수 제한
      const limitedVariants = parsed.variants.slice(0, maxVariants);

      return {
        original: query,
        variants: includeOriginal
          ? [query, ...limitedVariants]
          : limitedVariants,
        reasoning: parsed.reasoning,
      };
    }
  } catch {
    // LLM 호출 실패 시 원본 쿼리만 반환 (graceful degradation)
  }

  // 폴백: 규칙 기반 간단 확장
  return {
    original: query,
    variants: includeOriginal ? [query, ...ruleBasedExpansion(query)] : ruleBasedExpansion(query),
    reasoning: 'LLM 확장 실패 — 규칙 기반 폴백 사용',
  };
}

// ── 규칙 기반 폴백 ─────────────────────────────────────────────────────────

/**
 * 규칙 기반 쿼리 확장 (LLM 없이 사용 가능한 폴백)
 * 공공기관 도메인 동의어 사전 활용
 */
const SYNONYM_MAP: Record<string, string[]> = {
  '민원': ['민원 접수', '민원 처리', '민원 신청'],
  '세금': ['조세', '국세', '지방세', '세금 납부'],
  '환급': ['환급금', '환급 신청', '경정청구'],
  '허가': ['인허가', '허가 신청', '승인'],
  '등록': ['등록 신청', '등록증 발급'],
  '보조금': ['지원금', '보조금 신청', '교부금'],
  '복지': ['사회복지', '복지 서비스', '복지 혜택'],
  '계약': ['계약 체결', '조달 계약', '입찰'],
  '감사': ['감사 실시', '감사 결과', '내부감사'],
  '예산': ['예산 편성', '예산 집행', '세출예산'],
};

function ruleBasedExpansion(query: string): string[] {
  const expansions: string[] = [];

  for (const [keyword, synonyms] of Object.entries(SYNONYM_MAP)) {
    if (query.includes(keyword)) {
      // 키워드를 동의어로 치환
      for (const synonym of synonyms) {
        const expanded = query.replace(keyword, synonym);
        if (expanded !== query && !expansions.includes(expanded)) {
          expansions.push(expanded);
        }
      }
    }
  }

  return expansions.slice(0, 2); // 규칙 기반은 최대 2개
}

/**
 * 쿼리 확장 결과를 이용한 다중 임베딩 생성 도우미
 * 각 변형 쿼리에 대해 임베딩을 생성하고 병합
 */
export function mergeQueryVariants(expanded: ExpandedQuery): string[] {
  return expanded.variants;
}
