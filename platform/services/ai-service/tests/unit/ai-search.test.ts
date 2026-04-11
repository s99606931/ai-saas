// SVC-AI-ADV-R12 단위 테스트: AI 지능형 검색
// Design Ref: SVC-AI-ADV-R12 DESIGN §1~§4
// Plan SC: FR-ADV12.1~12.6
// CSAP: D-12 시스템 개발 보안, D-08 접근 통제

import { describe, it, expect, beforeEach } from 'vitest';

import {
  AISearchEngine,
  createAISearchEngine,
  type SearchSourceProvider,
  type SearchResultItem,
} from '../../src/lib/ai-search.js';
import type { LLMProvider } from '../../src/lib/llm-provider.js';

// -- 목 객체 ------------------------------------------------------------------

function createMockLLMProvider(): LLMProvider {
  return {
    chat: async () => ({
      text: '검색 결과를 요약한 내용입니다.',
      model: 'test-model',
      tokensUsed: 100,
    }),
    complete: async () => ({
      text: '완성된 텍스트',
      model: 'test-model',
      tokensUsed: 50,
    }),
  } as unknown as LLMProvider;
}

function createMockSource(
  sourceType: SearchResultItem['sourceType'],
  results: Partial<SearchResultItem>[],
): SearchSourceProvider {
  return {
    sourceType,
    search: async () =>
      results.map((r, i) => ({
        id: r.id ?? `${sourceType}-${i}`,
        title: r.title ?? `결과 ${i}`,
        snippet: r.snippet ?? `내용 ${i}`,
        source: r.source ?? sourceType,
        sourceType,
        relevanceScore: r.relevanceScore ?? 0.8 - i * 0.1,
        metadata: r.metadata,
      })),
  };
}

function createEmptySource(sourceType: SearchResultItem['sourceType']): SearchSourceProvider {
  return {
    sourceType,
    search: async () => [],
  };
}

function createFailingSource(sourceType: SearchResultItem['sourceType']): SearchSourceProvider {
  return {
    sourceType,
    search: async () => { throw new Error('소스 오류'); },
  };
}

// -- 의도 분류 -- FR-ADV12.1 ---------------------------------------------------

describe('AISearchEngine 의도 분류 (FR-ADV12.1)', () => {
  let engine: AISearchEngine;

  beforeEach(() => {
    engine = createAISearchEngine(
      createMockLLMProvider(),
      [createEmptySource('faq')],
    );
  });

  it('법률 관련 쿼리를 statute로 분류한다', async () => {
    const result = await engine.search('개인정보보호법 시행령 조문', { summarize: false });
    expect(result.intent.intent).toBe('statute');
    expect(result.intent.confidence).toBeGreaterThan(0.5);
  });

  it('민원 관련 쿼리를 civil로 분류한다', async () => {
    const result = await engine.search('주민등록증 발급 신청 방법', { summarize: false });
    // '발급', '신청' 키워드 → civil
    expect(result.intent.intent).toBe('civil');
  });

  it('절차 관련 쿼리를 procedure로 분류한다', async () => {
    const result = await engine.search('온라인 세금 납부 절차 안내', { summarize: false });
    expect(result.intent.intent).toBe('procedure');
  });

  it('일반 쿼리를 general로 분류한다', async () => {
    const result = await engine.search('오늘 날씨 정보', { summarize: false });
    expect(result.intent.intent).toBe('general');
  });

  it('키워드를 추출한다', async () => {
    const result = await engine.search('법률 조문 검색', { summarize: false });
    expect(result.intent.keywords.length).toBeGreaterThan(0);
  });
});

// -- 통합 검색 -- FR-ADV12.3 ---------------------------------------------------

describe('AISearchEngine 통합 검색 (FR-ADV12.3)', () => {
  it('다중 소스에서 결과를 통합한다', async () => {
    const engine = createAISearchEngine(
      createMockLLMProvider(),
      [
        createMockSource('statute', [
          { id: 's1', title: '법률 결과 1', relevanceScore: 0.9 },
          { id: 's2', title: '법률 결과 2', relevanceScore: 0.7 },
        ]),
        createMockSource('faq', [
          { id: 'f1', title: 'FAQ 결과 1', relevanceScore: 0.8 },
        ]),
      ],
    );

    const result = await engine.search('법률 검색', { summarize: false });
    expect(result.results.length).toBe(3);
    expect(result.totalResults).toBe(3);
  });

  it('소스 오류를 무시하고 계속 검색한다', async () => {
    const engine = createAISearchEngine(
      createMockLLMProvider(),
      [
        createFailingSource('statute'),
        createMockSource('faq', [
          { id: 'f1', title: 'FAQ 결과', relevanceScore: 0.8 },
        ]),
      ],
    );

    const result = await engine.search('검색', { summarize: false });
    // 실패한 소스 무시, FAQ 결과만 반환
    expect(result.results.length).toBe(1);
  });

  it('결과가 없으면 빈 배열', async () => {
    const engine = createAISearchEngine(
      createMockLLMProvider(),
      [createEmptySource('faq')],
    );

    const result = await engine.search('존재하지 않는 검색어', { summarize: false });
    expect(result.results).toHaveLength(0);
  });

  it('RRF 정렬로 다중 소스 결과를 병합한다', async () => {
    const engine = createAISearchEngine(
      createMockLLMProvider(),
      [
        createMockSource('statute', [
          { id: 'shared', title: '공통 결과', relevanceScore: 0.9 },
          { id: 's2', title: '법률만', relevanceScore: 0.5 },
        ]),
        createMockSource('faq', [
          { id: 'f1', title: 'FAQ만', relevanceScore: 0.95 },
        ]),
      ],
    );

    const result = await engine.search('법률 검색', { summarize: false });
    expect(result.results.length).toBeGreaterThan(0);
    // RRF에 의해 결과가 relevanceScore 순 정렬됨
    for (let i = 1; i < result.results.length; i++) {
      expect(result.results[i]!.relevanceScore).toBeLessThanOrEqual(result.results[i - 1]!.relevanceScore);
    }
  });
});

// -- 패싯 생성 -- FR-ADV12.5 ---------------------------------------------------

describe('AISearchEngine 패싯 (FR-ADV12.5)', () => {
  it('다중 소스에서 sourceType 패싯을 생성한다', async () => {
    const engine = createAISearchEngine(
      createMockLLMProvider(),
      [
        createMockSource('statute', [{ id: 's1' }, { id: 's2' }]),
        createMockSource('faq', [{ id: 'f1' }]),
      ],
    );

    const result = await engine.search('법률', { summarize: false });
    const sourceTypeFacet = result.facets.find((f) => f.field === 'sourceType');
    expect(sourceTypeFacet).toBeDefined();
    expect(sourceTypeFacet!.values.length).toBe(2);
  });

  it('단일 소스면 패싯 없음', async () => {
    const engine = createAISearchEngine(
      createMockLLMProvider(),
      [createMockSource('faq', [{ id: 'f1' }, { id: 'f2' }])],
    );

    const result = await engine.search('질문', { summarize: false });
    // 소스가 1종류이므로 sourceType 패싯 미생성
    expect(result.facets.find((f) => f.field === 'sourceType')).toBeUndefined();
  });
});

// -- AI 요약 -- FR-ADV12.4 ---------------------------------------------------

describe('AISearchEngine 요약 (FR-ADV12.4)', () => {
  it('결과가 있으면 요약을 생성한다', async () => {
    const engine = createAISearchEngine(
      createMockLLMProvider(),
      [createMockSource('faq', [{ id: 'f1', title: '결과' }])],
    );

    const result = await engine.search('질문', { summarize: true });
    expect(result.summary).toBeTruthy();
  });

  it('결과가 없으면 요약 생략', async () => {
    const engine = createAISearchEngine(
      createMockLLMProvider(),
      [createEmptySource('faq')],
    );

    const result = await engine.search('없는 결과', { summarize: true });
    expect(result.summary).toBeUndefined();
  });

  it('summarize: false이면 요약 생략', async () => {
    const engine = createAISearchEngine(
      createMockLLMProvider(),
      [createMockSource('faq', [{ id: 'f1' }])],
    );

    const result = await engine.search('질문', { summarize: false });
    expect(result.summary).toBeUndefined();
  });
});

// -- 메트릭 -- FR-ADV12.6 ---------------------------------------------------

describe('AISearchEngine 메트릭 (FR-ADV12.6)', () => {
  let engine: AISearchEngine;

  beforeEach(() => {
    engine = createAISearchEngine(
      createMockLLMProvider(),
      [
        createMockSource('faq', [{ id: 'f1' }]),
        createEmptySource('statute'),
      ],
    );
  });

  it('초기 메트릭은 0', () => {
    const metrics = engine.getMetrics();
    expect(metrics.totalSearches).toBe(0);
    expect(metrics.avgSearchTimeMs).toBe(0);
    expect(metrics.zeroResultRate).toBe(0);
  });

  it('검색 후 메트릭이 증가한다', async () => {
    await engine.search('법률 조문', { summarize: false });
    const metrics = engine.getMetrics();
    expect(metrics.totalSearches).toBe(1);
    expect(metrics.avgSearchTimeMs).toBeGreaterThanOrEqual(0);
    expect(metrics.intentDistribution.statute).toBe(1);
  });

  it('여러 검색 후 평균 메트릭', async () => {
    await engine.search('법률 조문', { summarize: false });
    await engine.search('민원 신청', { summarize: false });
    await engine.search('일반 질문', { summarize: false });

    const metrics = engine.getMetrics();
    expect(metrics.totalSearches).toBe(3);
    expect(metrics.intentDistribution.statute).toBe(1);
    expect(metrics.intentDistribution.civil).toBe(1);
  });

  it('메트릭을 초기화한다', async () => {
    await engine.search('법률', { summarize: false });
    engine.resetMetrics();
    const metrics = engine.getMetrics();
    expect(metrics.totalSearches).toBe(0);
  });

  it('결과 없는 검색의 zeroResultRate', async () => {
    const emptyEngine = createAISearchEngine(
      createMockLLMProvider(),
      [createEmptySource('faq')],
    );

    await emptyEngine.search('없는 결과 1', { summarize: false });
    await emptyEngine.search('없는 결과 2', { summarize: false });
    const metrics = emptyEngine.getMetrics();
    expect(metrics.zeroResultRate).toBe(1); // 2/2 = 100%
  });
});
