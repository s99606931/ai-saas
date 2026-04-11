// SVC-AI-ADV-R12 단위 테스트: 지능형 검색 엔진
// Design Ref: SVC-AI-ADV-R12 DESIGN §1~§5
// Plan SC: FR-ADV12.1~FR-ADV12.6
// CSAP: D-08 접근 통제, D-12 입력 검증

import { describe, it, expect, vi, beforeEach } from 'vitest';

// PII 마스킹 모의
vi.mock('../../src/lib/pii-masking.js', () => ({
  maskPII: vi.fn((text: string) => text.replace(/\d{6}-\d{7}/g, '***-***')),
}));

import {
  classifyIntent,
  rewriteQuery,
  generateFacets,
  summarizeResults,
  executeIntelligentSearch,
  intelligentSearchRequestSchema,
} from '../../src/lib/intelligent-search.js';
import type {
  SearchIntent,
  SearchResultItem,
  SearchSource,
  StructuredQuery,
} from '../../src/lib/intelligent-search.js';

// ── 테스트 헬퍼 ─────────────────────────────────────────────────────────────

function createMockResult(
  overrides: Partial<SearchResultItem> = {},
): SearchResultItem {
  return {
    id: crypto.randomUUID(),
    title: '테스트 문서',
    snippet: '테스트 내용입니다. 이것은 검색 결과 스니펫입니다.',
    source: 'document',
    score: 0.85,
    metadata: {},
    highlightedTerms: [],
    ...overrides,
  };
}

// ── 의도 분류 테스트 — Design §1 ────────────────────────────────────────────

describe('classifyIntent 의도 분류 (FR-ADV12.1)', () => {
  it('법령 관련 쿼리를 regulation으로 분류한다', () => {
    const intent = classifyIntent('개인정보보호법 시행령 개정 사항');
    expect(intent.type).toBe('regulation');
    expect(intent.confidence).toBeGreaterThan(0);
    expect(intent.keywords.length).toBeGreaterThan(0);
  });

  it('CSAP 키워드를 regulation으로 분류한다', () => {
    const intent = classifyIntent('CSAP 표준등급 인증 기준');
    expect(intent.type).toBe('regulation');
  });

  it('민원 관련 쿼리를 civil_affair로 분류한다', () => {
    const intent = classifyIntent('주민등록 등본 발급 신청 방법');
    expect(intent.type).toBe('civil_affair');
    expect(intent.keywords.length).toBeGreaterThan(0);
  });

  it('절차 관련 쿼리를 procedure로 분류한다', () => {
    const intent = classifyIntent('건축허가 신청방법 절차 안내');
    // civil_affair과 procedure 둘 다 해당 가능, 높은 쪽 우선
    expect(['procedure', 'civil_affair']).toContain(intent.type);
  });

  it('FAQ 관련 쿼리를 faq로 분류한다', () => {
    const intent = classifyIntent('자주 묻는 질문 연락처 안내');
    expect(intent.type).toBe('faq');
  });

  it('패턴 미매칭 시 confidence가 0.3이다', () => {
    // 어떤 패턴도 매칭되지 않으면 scores 배열 첫 항목이 선택됨
    // 구현 특성: maxScore=0일 때 find()가 첫 항목 반환
    const intent = classifyIntent('오늘 날씨');
    expect(intent.confidence).toBe(0.3);
    expect(intent.keywords).toHaveLength(0);
  });

  it('엔티티를 추출한다 (법령명)', () => {
    const intent = classifyIntent('전자정부법 제10조 해석');
    expect(intent.entities.length).toBeGreaterThan(0);
    expect(intent.entities.some((e) => e.includes('전자정부법'))).toBe(true);
  });

  it('엔티티를 추출한다 (기관명)', () => {
    const intent = classifyIntent('행정안전부 고시 조회');
    expect(intent.entities.some((e) => e.includes('행정안전부'))).toBe(true);
  });

  it('빈 키워드가 없는 경우 고유한 키워드만 반환한다', () => {
    const intent = classifyIntent('개인정보보호법 개인정보 처리방침');
    const uniqueKeywords = new Set(intent.keywords);
    expect(intent.keywords.length).toBe(uniqueKeywords.size);
  });

  it('confidence가 0~1 범위이다', () => {
    const intent = classifyIntent('CSAP 법률 시행령 고시 훈령 예규');
    expect(intent.confidence).toBeGreaterThanOrEqual(0);
    expect(intent.confidence).toBeLessThanOrEqual(1);
  });
});

// ── 쿼리 재작성 테스트 — Design §2 ─────────────────────────────────────────

describe('rewriteQuery 쿼리 재작성 (FR-ADV12.2)', () => {
  it('원본 쿼리를 보존한다', () => {
    const intent = classifyIntent('개인정보보호법 위반 사례');
    const query = rewriteQuery('개인정보보호법 위반 사례', intent);
    expect(query.originalQuery).toBe('개인정보보호법 위반 사례');
  });

  it('불용어를 제거한 재작성 쿼리를 생성한다', () => {
    const intent = classifyIntent('이것은 테스트입니다');
    const query = rewriteQuery('법률에 의한 처분을 조회', intent);
    // '에', '의', '을' 등 불용어가 제거됨
    expect(query.rewrittenQuery).not.toContain(' 에 ');
  });

  it('regulation 의도에 source 필터를 추가한다', () => {
    const intent: SearchIntent = {
      type: 'regulation',
      confidence: 0.9,
      keywords: ['법률'],
      entities: [],
    };
    const query = rewriteQuery('법률 검색', intent);
    const sourceFilter = query.filters.find((f) => f.field === 'source');
    expect(sourceFilter).toBeDefined();
    expect(sourceFilter?.value).toContain('regulation');
  });

  it('faq 의도에 source 필터를 추가한다', () => {
    const intent: SearchIntent = {
      type: 'faq',
      confidence: 0.8,
      keywords: ['FAQ'],
      entities: [],
    };
    const query = rewriteQuery('FAQ 조회', intent);
    const sourceFilter = query.filters.find((f) => f.field === 'source');
    expect(sourceFilter).toBeDefined();
    expect(sourceFilter?.value).toContain('faq');
  });

  it('엔티티를 필터로 변환한다', () => {
    const intent: SearchIntent = {
      type: 'regulation',
      confidence: 0.9,
      keywords: [],
      entities: ['개인정보보호법'],
    };
    const query = rewriteQuery('개인정보보호법 조회', intent);
    const entityFilter = query.filters.find((f) => f.field === 'entity');
    expect(entityFilter).toBeDefined();
    expect(entityFilter?.value).toBe('개인정보보호법');
  });

  it('날짜 범위를 추출한다', () => {
    const intent = classifyIntent('2024년 개정 법률');
    const query = rewriteQuery('2024년 개정 법률', intent);
    expect(query.dateRange).toBeDefined();
    expect(query.dateRange?.from).toBe('2024-01-01');
    expect(query.dateRange?.to).toBe('2024-12-31');
  });

  it('날짜가 없으면 dateRange가 undefined이다', () => {
    const intent = classifyIntent('법률 조회');
    const query = rewriteQuery('법률 조회', intent);
    expect(query.dateRange).toBeUndefined();
  });

  it('regulation 의도는 authority 정렬을 사용한다', () => {
    const intent: SearchIntent = {
      type: 'regulation',
      confidence: 0.9,
      keywords: [],
      entities: [],
    };
    const query = rewriteQuery('법률 조회', intent);
    expect(query.sortBy).toBe('authority');
  });

  it('일반 의도는 relevance 정렬을 사용한다', () => {
    const intent: SearchIntent = {
      type: 'general',
      confidence: 0.3,
      keywords: [],
      entities: [],
    };
    const query = rewriteQuery('일반 조회', intent);
    expect(query.sortBy).toBe('relevance');
  });
});

// ── 패싯 생성 테스트 — Design §4 ───────────────────────────────────────────

describe('generateFacets 패싯 생성 (FR-ADV12.5)', () => {
  it('다중 소스의 결과에서 소스 패싯을 생성한다', () => {
    const results: SearchResultItem[] = [
      createMockResult({ source: 'regulation' }),
      createMockResult({ source: 'regulation' }),
      createMockResult({ source: 'document' }),
      createMockResult({ source: 'faq' }),
    ];
    const facets = generateFacets(results);
    expect(facets.length).toBeGreaterThan(0);
    const sourceFacet = facets.find((f) => f.field === 'source');
    expect(sourceFacet).toBeDefined();
    expect(sourceFacet?.values.length).toBe(3);
  });

  it('소스 패싯을 개수 내림차순으로 정렬한다', () => {
    const results: SearchResultItem[] = [
      createMockResult({ source: 'document' }),
      createMockResult({ source: 'regulation' }),
      createMockResult({ source: 'regulation' }),
      createMockResult({ source: 'regulation' }),
    ];
    const facets = generateFacets(results);
    const sourceFacet = facets.find((f) => f.field === 'source')!;
    expect(sourceFacet.values[0]?.value).toBe('regulation');
    expect(sourceFacet.values[0]?.count).toBe(3);
  });

  it('단일 소스면 패싯을 생성하지 않는다', () => {
    const results: SearchResultItem[] = [
      createMockResult({ source: 'document' }),
      createMockResult({ source: 'document' }),
    ];
    const facets = generateFacets(results);
    expect(facets.length).toBe(0);
  });

  it('빈 결과는 빈 패싯을 반환한다', () => {
    const facets = generateFacets([]);
    expect(facets).toHaveLength(0);
  });
});

// ── 결과 요약 테스트 — Design §3 ───────────────────────────────────────────

describe('summarizeResults 결과 요약 (FR-ADV12.4)', () => {
  it('결과가 없으면 안내 메시지를 반환한다', () => {
    const intent: SearchIntent = { type: 'general', confidence: 0.3, keywords: [], entities: [] };
    const summary = summarizeResults([], intent);
    expect(summary).toBe('검색 결과가 없습니다.');
  });

  it('결과가 있으면 요약 텍스트를 생성한다', () => {
    const intent: SearchIntent = {
      type: 'regulation',
      confidence: 0.9,
      keywords: ['개인정보보호법'],
      entities: [],
    };
    const results: SearchResultItem[] = [
      createMockResult({
        title: '개인정보보호법 제15조',
        snippet: '개인정보의 수집 이용에 관한 규정입니다.',
        source: 'regulation',
      }),
      createMockResult({
        title: '개인정보 처리방침 가이드',
        snippet: '처리방침 작성 가이드입니다.',
        source: 'document',
      }),
    ];
    const summary = summarizeResults(results, intent);
    expect(summary).toContain('개인정보보호법');
    expect(summary).toContain('2건');
    expect(summary).toContain('법령/규정');
  });

  it('상위 3건까지만 요약에 포함한다', () => {
    const intent: SearchIntent = {
      type: 'general',
      confidence: 0.3,
      keywords: ['테스트'],
      entities: [],
    };
    const results: SearchResultItem[] = Array.from({ length: 10 }, (_, i) =>
      createMockResult({ title: `문서 ${i}`, source: 'document' }),
    );
    const summary = summarizeResults(results, intent);
    expect(summary).toContain('10건');
    // 1. 2. 3. 패턴 확인 (상위 3건)
    expect(summary).toContain('1.');
    expect(summary).toContain('2.');
    expect(summary).toContain('3.');
    expect(summary).not.toContain('4.');
  });
});

// ── 요청 스키마 검증 ────────────────────────────────────────────────────────

describe('intelligentSearchRequestSchema 요청 검증', () => {
  it('유효한 요청을 통과시킨다', () => {
    const result = intelligentSearchRequestSchema.safeParse({
      query: '개인정보보호법 조회',
      tenantId: 'tenant-1',
      userId: 'user-1',
    });
    expect(result.success).toBe(true);
  });

  it('빈 쿼리를 거부한다', () => {
    const result = intelligentSearchRequestSchema.safeParse({
      query: '',
      tenantId: 'tenant-1',
      userId: 'user-1',
    });
    expect(result.success).toBe(false);
  });

  it('1000자 초과 쿼리를 거부한다', () => {
    const result = intelligentSearchRequestSchema.safeParse({
      query: 'a'.repeat(1001),
      tenantId: 'tenant-1',
      userId: 'user-1',
    });
    expect(result.success).toBe(false);
  });

  it('tenantId 누락을 거부한다', () => {
    const result = intelligentSearchRequestSchema.safeParse({
      query: '테스트',
      userId: 'user-1',
    });
    expect(result.success).toBe(false);
  });

  it('선택적 필드를 허용한다', () => {
    const result = intelligentSearchRequestSchema.safeParse({
      query: '테스트',
      tenantId: 'tenant-1',
      userId: 'user-1',
      sources: ['regulation', 'faq'],
      maxResults: 10,
      includeAISummary: true,
      filters: [{ field: 'category', operator: 'eq', value: '법률' }],
    });
    expect(result.success).toBe(true);
  });

  it('유효하지 않은 sources를 거부한다', () => {
    const result = intelligentSearchRequestSchema.safeParse({
      query: '테스트',
      tenantId: 'tenant-1',
      userId: 'user-1',
      sources: ['invalid_source'],
    });
    expect(result.success).toBe(false);
  });
});

// ── 통합 검색 실행 테스트 — Design §5 ──────────────────────────────────────

describe('executeIntelligentSearch 통합 검색 (FR-ADV12.3)', () => {
  const mockSearchFn = vi.fn();

  beforeEach(() => {
    mockSearchFn.mockReset();
  });

  it('전체 파이프라인을 실행한다', async () => {
    const mockResults: SearchResultItem[] = [
      createMockResult({ source: 'regulation', score: 0.95 }),
      createMockResult({ source: 'document', score: 0.80 }),
    ];
    mockSearchFn.mockResolvedValue(mockResults);

    const result = await executeIntelligentSearch(
      {
        query: '개인정보보호법 시행령',
        tenantId: 'tenant-1',
        userId: 'user-1',
      },
      mockSearchFn,
    );

    expect(result.intent).toBeDefined();
    expect(result.query).toBeDefined();
    expect(result.results).toHaveLength(2);
    expect(result.summary.length).toBeGreaterThan(0);
    expect(result.searchTimeMs).toBeGreaterThanOrEqual(0);
    expect(result.totalCount).toBe(2);
    expect(result.metadata.avgScore).toBeGreaterThan(0);
  });

  it('maxResults로 결과를 제한한다', async () => {
    const mockResults = Array.from({ length: 30 }, (_, i) =>
      createMockResult({ title: `문서 ${i}` }),
    );
    mockSearchFn.mockResolvedValue(mockResults);

    const result = await executeIntelligentSearch(
      {
        query: '일반 검색',
        tenantId: 'tenant-1',
        userId: 'user-1',
        maxResults: 5,
      },
      mockSearchFn,
    );

    expect(result.results).toHaveLength(5);
    expect(result.totalCount).toBe(30);
  });

  it('사용자 지정 필터를 쿼리에 추가한다', async () => {
    mockSearchFn.mockResolvedValue([]);

    await executeIntelligentSearch(
      {
        query: '테스트',
        tenantId: 'tenant-1',
        userId: 'user-1',
        filters: [{ field: 'category', operator: 'eq', value: '법률' }],
      },
      mockSearchFn,
    );

    const calledQuery: StructuredQuery = mockSearchFn.mock.calls[0][0];
    expect(calledQuery.filters.some((f) => f.field === 'category')).toBe(true);
  });

  it('sources를 지정할 수 있다', async () => {
    mockSearchFn.mockResolvedValue([]);

    await executeIntelligentSearch(
      {
        query: '테스트',
        tenantId: 'tenant-1',
        userId: 'user-1',
        sources: ['regulation'],
      },
      mockSearchFn,
    );

    const calledSources: SearchSource[] = mockSearchFn.mock.calls[0][1];
    expect(calledSources).toEqual(['regulation']);
  });

  it('includeAISummary=false이면 빈 요약을 반환한다', async () => {
    mockSearchFn.mockResolvedValue([createMockResult()]);

    const result = await executeIntelligentSearch(
      {
        query: '테스트',
        tenantId: 'tenant-1',
        userId: 'user-1',
        includeAISummary: false,
      },
      mockSearchFn,
    );

    expect(result.summary).toBe('');
  });

  it('소스별 결과 수를 메타데이터에 포함한다', async () => {
    const mockResults: SearchResultItem[] = [
      createMockResult({ source: 'regulation' }),
      createMockResult({ source: 'regulation' }),
      createMockResult({ source: 'faq' }),
    ];
    mockSearchFn.mockResolvedValue(mockResults);

    const result = await executeIntelligentSearch(
      {
        query: '법률 검색',
        tenantId: 'tenant-1',
        userId: 'user-1',
      },
      mockSearchFn,
    );

    expect(result.metadata.sourceCounts.regulation).toBe(2);
    expect(result.metadata.sourceCounts.faq).toBe(1);
    expect(result.metadata.sourceCounts.document).toBe(0);
  });

  it('빈 결과에서 avgScore가 0이다', async () => {
    mockSearchFn.mockResolvedValue([]);

    const result = await executeIntelligentSearch(
      {
        query: '없는 결과',
        tenantId: 'tenant-1',
        userId: 'user-1',
      },
      mockSearchFn,
    );

    expect(result.results).toHaveLength(0);
    expect(result.metadata.avgScore).toBe(0);
  });

  it('기본 sources는 4개 전체이다', async () => {
    mockSearchFn.mockResolvedValue([]);

    await executeIntelligentSearch(
      {
        query: '테스트',
        tenantId: 'tenant-1',
        userId: 'user-1',
      },
      mockSearchFn,
    );

    const calledSources: SearchSource[] = mockSearchFn.mock.calls[0][1];
    expect(calledSources).toEqual(['regulation', 'document', 'faq', 'admin_db']);
  });
});
