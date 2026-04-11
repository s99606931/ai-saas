// 지능형 검색 엔진 — FR-ADV12.1~12.6
// Design Ref: SVC-AI-ADV-R12 DESIGN §1~§5
// Plan SC: SC-1 (의도 분류), SC-2 (쿼리 재작성), SC-3 (다중 소스 통합), SC-4 (결과 요약)
// CSAP: D-08 접근 통제 (권한 기반 검색 범위), D-12 입력 검증
// N2SF: N-05 O등급 데이터만 검색

import { z } from 'zod';
import { maskPII } from './pii-masking.js';

// ── 타입 정의 ────────────────────────────────────────────────────────────────

/** 검색 의도 유형 */
export type SearchIntentType = 'regulation' | 'civil_affair' | 'procedure' | 'general' | 'faq';

/** 검색 의도 분류 결과 */
export interface SearchIntent {
  type: SearchIntentType;
  confidence: number;
  keywords: string[];
  entities: string[];
}

/** 재작성된 구조화 쿼리 */
export interface StructuredQuery {
  originalQuery: string;
  rewrittenQuery: string;
  filters: SearchFilter[];
  dateRange?: { from: string; to: string };
  sortBy: 'relevance' | 'date' | 'authority';
}

/** 검색 필터 */
export interface SearchFilter {
  field: string;
  operator: 'eq' | 'contains' | 'in' | 'range';
  value: string | string[];
}

/** 검색 결과 항목 */
export interface SearchResultItem {
  id: string;
  title: string;
  snippet: string;
  source: SearchSource;
  score: number;
  metadata: Record<string, unknown>;
  highlightedTerms: string[];
}

/** 검색 소스 */
export type SearchSource = 'regulation' | 'document' | 'faq' | 'admin_db';

/** 패싯 항목 */
export interface Facet {
  field: string;
  label: string;
  values: Array<{
    value: string;
    count: number;
    selected: boolean;
  }>;
}

/** 통합 검색 결과 */
export interface IntelligentSearchResult {
  query: StructuredQuery;
  intent: SearchIntent;
  results: SearchResultItem[];
  summary: string;
  facets: Facet[];
  totalCount: number;
  searchTimeMs: number;
  metadata: {
    sourceCounts: Record<SearchSource, number>;
    avgScore: number;
  };
}

/** 검색 요청 스키마 */
export const intelligentSearchRequestSchema = z.object({
  query: z.string().min(1).max(1000),
  tenantId: z.string().min(1).max(100),
  userId: z.string().min(1).max(100),
  sources: z.array(z.enum(['regulation', 'document', 'faq', 'admin_db'])).optional(),
  maxResults: z.number().int().min(1).max(100).optional(),
  includeAISummary: z.boolean().optional(),
  filters: z.array(z.object({
    field: z.string(),
    operator: z.enum(['eq', 'contains', 'in', 'range']),
    value: z.union([z.string(), z.array(z.string())]),
  })).optional(),
});

export type IntelligentSearchRequest = z.infer<typeof intelligentSearchRequestSchema>;

// ── 의도 분류기 — Design §1 ─────────────────────────────────────────────────

/** 규칙 기반 의도 분류 (LLM 호출 없이 빠른 분류) */
export function classifyIntent(query: string): SearchIntent {
  const normalizedQuery = query.toLowerCase().trim();
  const keywords: string[] = [];
  const entities: string[] = [];

  // 규칙 기반 키워드 추출
  const regulationPatterns = [
    /법(?:률|령|안|규|조|시행)/,
    /(?:개인정보|정보통신|전자정부|행정절차)/,
    /(?:CSAP|N2SF|ISMS)/i,
    /(?:고시|훈령|예규|지침|조례)/,
  ];

  const civilAffairPatterns = [
    /(?:신청|발급|등록|변경|취소|민원|접수)/,
    /(?:주민등록|건축허가|사업자|인허가)/,
    /(?:서류|구비서류|첨부|서식)/,
  ];

  const procedurePatterns = [
    /(?:방법|절차|과정|순서|단계|how|어떻게)/i,
    /(?:신청방법|접수방법|처리절차)/,
  ];

  const faqPatterns = [
    /(?:자주|묻는|질문|FAQ)/i,
    /(?:문의|전화번호|연락처|영업시간|운영시간)/,
  ];

  // 의도 점수 계산
  let regulationScore = 0;
  let civilAffairScore = 0;
  let procedureScore = 0;
  let faqScore = 0;

  for (const pattern of regulationPatterns) {
    if (pattern.test(normalizedQuery)) {
      regulationScore += 0.3;
      const match = normalizedQuery.match(pattern);
      if (match) keywords.push(match[0]);
    }
  }

  for (const pattern of civilAffairPatterns) {
    if (pattern.test(normalizedQuery)) {
      civilAffairScore += 0.3;
      const match = normalizedQuery.match(pattern);
      if (match) keywords.push(match[0]);
    }
  }

  for (const pattern of procedurePatterns) {
    if (pattern.test(normalizedQuery)) {
      procedureScore += 0.3;
      const match = normalizedQuery.match(pattern);
      if (match) keywords.push(match[0]);
    }
  }

  for (const pattern of faqPatterns) {
    if (pattern.test(normalizedQuery)) {
      faqScore += 0.3;
      const match = normalizedQuery.match(pattern);
      if (match) keywords.push(match[0]);
    }
  }

  // 엔티티 추출 (법령명, 기관명)
  const entityPattern = /((?:[\uAC00-\uD7A3]+){2,}(?:법|규정|조례|청|부|처|원|위원회))/g;
  for (const match of normalizedQuery.matchAll(entityPattern)) {
    const captured: string | undefined = match[1];
    if (captured !== undefined) {
      entities.push(captured);
    }
  }

  // 최고 점수 의도 선택
  const scores: Array<[SearchIntentType, number]> = [
    ['regulation', regulationScore],
    ['civil_affair', civilAffairScore],
    ['procedure', procedureScore],
    ['faq', faqScore],
  ];

  const maxScore = Math.max(...scores.map(([, s]) => s));
  const bestIntent = scores.find(([, s]) => s === maxScore)?.[0] ?? 'general';
  const confidence = maxScore > 0 ? Math.min(maxScore, 1.0) : 0.3;

  return {
    type: bestIntent,
    confidence,
    keywords: [...new Set(keywords)],
    entities: [...new Set(entities)],
  };
}

// ── 쿼리 재작성 — Design §2 ─────────────────────────────────────────────────

/** 자연어 쿼리를 구조화 쿼리로 변환 */
export function rewriteQuery(query: string, intent: SearchIntent): StructuredQuery {
  const filters: SearchFilter[] = [];

  // 의도별 필터 추가
  if (intent.type === 'regulation') {
    filters.push({
      field: 'source',
      operator: 'in',
      value: ['regulation'],
    });
  } else if (intent.type === 'faq') {
    filters.push({
      field: 'source',
      operator: 'in',
      value: ['faq'],
    });
  }

  // 엔티티를 필터로 변환
  for (const entity of intent.entities) {
    filters.push({
      field: 'entity',
      operator: 'contains',
      value: entity,
    });
  }

  // 날짜 범위 추출
  let dateRange: { from: string; to: string } | undefined;
  const dateMatch = query.match(/(\d{4})년/);
  if (dateMatch) {
    const year = dateMatch[1];
    dateRange = { from: `${year}-01-01`, to: `${year}-12-31` };
  }

  // 쿼리 재작성: 키워드 강조 + 불용어 제거
  const stopWords = ['을', '를', '이', '가', '은', '는', '에', '의', '로', '으로', '에서', '와', '과', '도', '만'];
  const tokens = query.split(/\s+/).filter((t) => !stopWords.includes(t));
  const rewrittenQuery = tokens.join(' ');

  return {
    originalQuery: query,
    rewrittenQuery: maskPII(rewrittenQuery),
    filters,
    dateRange,
    sortBy: intent.type === 'regulation' ? 'authority' : 'relevance',
  };
}

// ── 패싯 생성 — Design §4 ───────────────────────────────────────────────────

/** 검색 결과에서 자동 패싯 생성 */
export function generateFacets(results: SearchResultItem[]): Facet[] {
  const facets: Facet[] = [];

  // 소스별 패싯
  const sourceCounts = new Map<string, number>();
  for (const result of results) {
    sourceCounts.set(result.source, (sourceCounts.get(result.source) ?? 0) + 1);
  }
  if (sourceCounts.size > 1) {
    facets.push({
      field: 'source',
      label: '출처',
      values: [...sourceCounts.entries()]
        .map(([value, count]) => ({ value, count, selected: false }))
        .sort((a, b) => b.count - a.count),
    });
  }

  return facets;
}

// ── 결과 요약 생성 — Design §3 ──────────────────────────────────────────────

/** 검색 결과 요약 텍스트 생성 (LLM 없이 추출 기반) */
export function summarizeResults(results: SearchResultItem[], intent: SearchIntent): string {
  if (results.length === 0) {
    return '검색 결과가 없습니다.';
  }

  const topResults = results.slice(0, 3);
  const sourceLabel: Record<SearchSource, string> = {
    regulation: '법령/규정',
    document: '공문서',
    faq: 'FAQ',
    admin_db: '행정 데이터',
  };

  const sourceSummary = [...new Set(topResults.map((r) => r.source))]
    .map((s) => sourceLabel[s])
    .join(', ');

  const keySnippets = topResults
    .map((r, i) => `${i + 1}. ${r.title}: ${r.snippet.slice(0, 100)}`)
    .join('\n');

  return `"${intent.keywords.join(', ')}" 관련 ${results.length}건의 결과를 찾았습니다.\n` +
    `주요 출처: ${sourceSummary}\n\n${keySnippets}`;
}

// ── 통합 검색 실행 — Design §5 ──────────────────────────────────────────────

/**
 * 지능형 검색 파이프라인 실행
 *
 * 1. 의도 분류 → 2. 쿼리 재작성 → 3. 다중 소스 검색 → 4. 결과 병합/정렬 → 5. 패싯 생성 → 6. 요약
 */
export async function executeIntelligentSearch(
  request: IntelligentSearchRequest,
  searchFn: (query: StructuredQuery, sources: SearchSource[]) => Promise<SearchResultItem[]>,
): Promise<IntelligentSearchResult> {
  const startTime = Date.now();

  // 1. 의도 분류
  const intent = classifyIntent(request.query);

  // 2. 쿼리 재작성
  const structuredQuery = rewriteQuery(request.query, intent);

  // 사용자 지정 필터 추가
  if (request.filters) {
    for (const f of request.filters) {
      structuredQuery.filters.push(f);
    }
  }

  // 3. 다중 소스 검색
  const sources = (request.sources ?? ['regulation', 'document', 'faq', 'admin_db']) as SearchSource[];
  const results = await searchFn(structuredQuery, sources);

  // 4. 상위 N건 제한
  const maxResults = request.maxResults ?? 20;
  const limitedResults = results.slice(0, maxResults);

  // 5. 패싯 생성
  const facets = generateFacets(limitedResults);

  // 6. 요약 생성
  const summary = request.includeAISummary !== false
    ? summarizeResults(limitedResults, intent)
    : '';

  // 소스별 결과 수
  const sourceCounts: Record<SearchSource, number> = {
    regulation: 0,
    document: 0,
    faq: 0,
    admin_db: 0,
  };
  for (const r of limitedResults) {
    sourceCounts[r.source]++;
  }

  const avgScore = limitedResults.length > 0
    ? limitedResults.reduce((sum, r) => sum + r.score, 0) / limitedResults.length
    : 0;

  return {
    query: structuredQuery,
    intent,
    results: limitedResults,
    summary,
    facets,
    totalCount: results.length,
    searchTimeMs: Date.now() - startTime,
    metadata: {
      sourceCounts,
      avgScore,
    },
  };
}
