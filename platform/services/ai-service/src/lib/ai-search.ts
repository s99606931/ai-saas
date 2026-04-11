// AI 지능형 검색 — FR-ADV12.1~FR-ADV12.6
// Design Ref: SVC-AI-ADV-R12 DESIGN §1~§4
// CSAP: D-12 시스템 개발 보안, D-08 접근 통제
// N2SF: N-05 O등급 데이터만 검색

import type { LLMProvider, LLMMessage } from './llm-provider.js';
import { maskPII } from './pii-masking.js';

// ── 타입 정의 ────────────────────────────────────────────────────────────────

/** 검색 의도 유형 — FR-ADV12.1 */
export type SearchIntent = 'statute' | 'civil' | 'procedure' | 'general';

/** 의도 분류 결과 */
export interface IntentClassification {
  intent: SearchIntent;
  confidence: number;
  keywords: string[];
  filters: Record<string, string>;
}

/** 검색 결과 항목 */
export interface SearchResultItem {
  id: string;
  title: string;
  snippet: string;
  source: string;
  sourceType: 'statute' | 'official_doc' | 'faq' | 'admin_db';
  relevanceScore: number;
  metadata?: Record<string, unknown>;
}

/** 패싯 (분류 필터) — FR-ADV12.5 */
export interface SearchFacet {
  field: string;
  label: string;
  values: Array<{ value: string; count: number }>;
}

/** 통합 검색 결과 */
export interface AISearchResult {
  /** 원본 쿼리 */
  query: string;
  /** 의도 분류 */
  intent: IntentClassification;
  /** 재작성된 쿼리 */
  rewrittenQuery: string;
  /** 검색 결과 */
  results: SearchResultItem[];
  /** AI 요약 */
  summary?: string;
  /** 자동 패싯 */
  facets: SearchFacet[];
  /** 검색 소요 시간 (ms) */
  searchTimeMs: number;
  /** 총 결과 수 */
  totalResults: number;
}

/** 검색 메트릭 */
export interface SearchMetrics {
  totalSearches: number;
  intentDistribution: Record<SearchIntent, number>;
  avgSearchTimeMs: number;
  avgResultCount: number;
  zeroResultRate: number;
}

// ── 검색 소스 인터페이스 (DIP) ───────────────────────────────────────────────

/** 검색 소스 프로바이더 */
export interface SearchSourceProvider {
  sourceType: SearchResultItem['sourceType'];
  search(query: string, filters: Record<string, string>, limit: number): Promise<SearchResultItem[]>;
}

// ── 의도 분류 패턴 ──────────────────────────────────────────────────────────

const INTENT_PATTERNS: Array<{ intent: SearchIntent; patterns: RegExp[]; keywords: string[] }> = [
  {
    intent: 'statute',
    patterns: [/법률|법령|시행령|시행규칙|고시|조문|제\d+조|법\s+제\d+호/],
    keywords: ['법률', '법령', '시행령', '조문', '고시'],
  },
  {
    intent: 'civil',
    patterns: [/민원|신청|발급|등록|신고|접수|증명서|허가/],
    keywords: ['민원', '신청', '발급', '등록', '증명서'],
  },
  {
    intent: 'procedure',
    patterns: [/방법|절차|과정|순서|어떻게|단계|가이드|안내/],
    keywords: ['방법', '절차', '안내', '가이드'],
  },
];

// ── AI 검색 엔진 ─────────────────────────────────────────────────────────────

/**
 * AI 지능형 검색 엔진
 *
 * 자연어 질문을 분석하여 의도를 파악하고, 다중 소스에서 통합 검색 후
 * AI로 결과를 요약합니다.
 */
export class AISearchEngine {
  private readonly provider: LLMProvider;
  private readonly sources: SearchSourceProvider[];

  // 메트릭
  private searchCount = 0;
  private totalSearchTimeMs = 0;
  private totalResultCount = 0;
  private zeroResultCount = 0;
  private intentCounts: Record<SearchIntent, number> = { statute: 0, civil: 0, procedure: 0, general: 0 };

  constructor(provider: LLMProvider, sources: SearchSourceProvider[]) {
    this.provider = provider;
    this.sources = sources;
  }

  /**
   * 자연어 검색을 수행합니다
   */
  async search(query: string, options?: { limit?: number; summarize?: boolean }): Promise<AISearchResult> {
    const startTime = Date.now();
    const limit = options?.limit ?? 20;
    const shouldSummarize = options?.summarize ?? true;

    // 1. 의도 분류 — FR-ADV12.1
    const intent = this.classifyIntent(query);
    this.intentCounts[intent.intent]++;

    // 2. 쿼리 재작성 — FR-ADV12.2
    const rewrittenQuery = await this.rewriteQuery(query, intent);

    // 3. 다중 소스 통합 검색 — FR-ADV12.3
    const allResults: SearchResultItem[] = [];
    const searchPromises = this.sources.map(async (source) => {
      try {
        const results = await source.search(rewrittenQuery, intent.filters, limit);
        return results;
      } catch {
        return [] as SearchResultItem[];
      }
    });

    const sourceResults = await Promise.all(searchPromises);
    for (const results of sourceResults) {
      allResults.push(...results);
    }

    // RRF 병합 (Reciprocal Rank Fusion)
    const mergedResults = this.rrfMerge(allResults, limit);

    // PII 마스킹
    for (const result of mergedResults) {
      result.title = maskPII(result.title);
      result.snippet = maskPII(result.snippet);
    }

    // 4. AI 요약 — FR-ADV12.4
    let summary: string | undefined;
    if (shouldSummarize && mergedResults.length > 0) {
      summary = await this.summarizeResults(query, mergedResults.slice(0, 5));
    }

    // 5. 패싯 생성 — FR-ADV12.5
    const facets = this.generateFacets(mergedResults);

    // 메트릭 — FR-ADV12.6
    const searchTimeMs = Date.now() - startTime;
    this.searchCount++;
    this.totalSearchTimeMs += searchTimeMs;
    this.totalResultCount += mergedResults.length;
    if (mergedResults.length === 0) this.zeroResultCount++;

    return {
      query,
      intent,
      rewrittenQuery,
      results: mergedResults,
      summary,
      facets,
      searchTimeMs,
      totalResults: allResults.length,
    };
  }

  // ── 의도 분류 — FR-ADV12.1 ────────────────────────────────────────

  private classifyIntent(query: string): IntentClassification {
    let bestIntent: SearchIntent = 'general';
    let bestConfidence = 0;
    let bestKeywords: string[] = [];

    for (const entry of INTENT_PATTERNS) {
      for (const pattern of entry.patterns) {
        if (pattern.test(query)) {
          const confidence = 0.8;
          if (confidence > bestConfidence) {
            bestConfidence = confidence;
            bestIntent = entry.intent;
            bestKeywords = entry.keywords.filter((k) => query.includes(k));
          }
        }
      }
    }

    // 키워드 추출
    const keywords = bestKeywords.length > 0
      ? bestKeywords
      : query.split(/\s+/).filter((w) => w.length >= 2).slice(0, 5);

    return {
      intent: bestIntent,
      confidence: bestConfidence || 0.5,
      keywords,
      filters: {},
    };
  }

  // ── 쿼리 재작성 — FR-ADV12.2 ──────────────────────────────────────

  private async rewriteQuery(query: string, intent: IntentClassification): Promise<string> {
    // 단순 질문은 키워드 추출만
    if (intent.confidence > 0.7 && intent.keywords.length > 0) {
      return intent.keywords.join(' ');
    }

    // LLM 기반 재작성
    try {
      const messages: LLMMessage[] = [
        {
          role: 'system',
          content: '사용자 질문을 검색에 최적화된 키워드 쿼리로 변환하십시오. 키워드만 반환하십시오.',
        },
        { role: 'user', content: query },
      ];

      const response = await this.provider.chat(messages, { maxTokens: 100, temperature: 0 });
      return response.text.trim();
    } catch {
      return query; // LLM 실패 시 원본 사용
    }
  }

  // ── RRF 병합 ───────────────────────────────────────────────────────

  private rrfMerge(results: SearchResultItem[], limit: number): SearchResultItem[] {
    const K = 60; // RRF 상수
    const scoreMap = new Map<string, { item: SearchResultItem; score: number }>();

    // 소스별로 그룹화
    const bySource = new Map<string, SearchResultItem[]>();
    for (const item of results) {
      const key = item.sourceType;
      const list = bySource.get(key) ?? [];
      list.push(item);
      bySource.set(key, list);
    }

    // 각 소스 내에서 RRF 점수 계산
    for (const sourceResults of bySource.values()) {
      sourceResults.sort((a, b) => b.relevanceScore - a.relevanceScore);
      for (let rank = 0; rank < sourceResults.length; rank++) {
        const item = sourceResults[rank]!;
        const rrfScore = 1 / (K + rank + 1);
        const existing = scoreMap.get(item.id);
        if (existing) {
          existing.score += rrfScore;
        } else {
          scoreMap.set(item.id, { item, score: rrfScore });
        }
      }
    }

    return Array.from(scoreMap.values())
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map(({ item, score }) => ({ ...item, relevanceScore: score }));
  }

  // ── 결과 요약 — FR-ADV12.4 ────────────────────────────────────────

  private async summarizeResults(query: string, topResults: SearchResultItem[]): Promise<string> {
    const resultsText = topResults
      .map((r, i) => `${i + 1}. [${r.source}] ${r.title}: ${r.snippet}`)
      .join('\n');

    try {
      const messages: LLMMessage[] = [
        {
          role: 'system',
          content: '검색 결과를 바탕으로 사용자 질문에 대한 간결한 답변을 작성하십시오. 한국어로 3-5문장으로 요약하십시오.',
        },
        {
          role: 'user',
          content: `질문: ${query}\n\n검색 결과:\n${resultsText}`,
        },
      ];

      const response = await this.provider.chat(messages, { maxTokens: 500, temperature: 0.3 });
      return maskPII(response.text);
    } catch {
      return ''; // 요약 실패 시 빈 문자열
    }
  }

  // ── 패싯 생성 — FR-ADV12.5 ────────────────────────────────────────

  private generateFacets(results: SearchResultItem[]): SearchFacet[] {
    // 소스 유형별 패싯
    const sourceCounts = new Map<string, number>();
    for (const result of results) {
      sourceCounts.set(result.sourceType, (sourceCounts.get(result.sourceType) ?? 0) + 1);
    }

    const facets: SearchFacet[] = [];

    if (sourceCounts.size > 1) {
      facets.push({
        field: 'sourceType',
        label: '출처',
        values: Array.from(sourceCounts.entries())
          .map(([value, count]) => ({ value, count }))
          .sort((a, b) => b.count - a.count),
      });
    }

    return facets;
  }

  // ── 검색 메트릭 — FR-ADV12.6 ──────────────────────────────────────

  getMetrics(): SearchMetrics {
    return {
      totalSearches: this.searchCount,
      intentDistribution: { ...this.intentCounts },
      avgSearchTimeMs: this.searchCount > 0 ? Math.round(this.totalSearchTimeMs / this.searchCount) : 0,
      avgResultCount: this.searchCount > 0 ? Math.round(this.totalResultCount / this.searchCount) : 0,
      zeroResultRate: this.searchCount > 0 ? this.zeroResultCount / this.searchCount : 0,
    };
  }

  resetMetrics(): void {
    this.searchCount = 0;
    this.totalSearchTimeMs = 0;
    this.totalResultCount = 0;
    this.zeroResultCount = 0;
    this.intentCounts = { statute: 0, civil: 0, procedure: 0, general: 0 };
  }
}

// ── 팩토리 ───────────────────────────────────────────────────────────────────

export function createAISearchEngine(
  provider: LLMProvider,
  sources: SearchSourceProvider[],
): AISearchEngine {
  return new AISearchEngine(provider, sources);
}
