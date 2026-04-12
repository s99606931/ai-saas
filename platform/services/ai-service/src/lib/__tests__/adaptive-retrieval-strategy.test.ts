import { describe, it, expect, beforeEach } from 'vitest';
import {
  AdaptiveRetrievalStrategy,
  type RetrieverSet,
  type RetrievalDoc,
} from '../adaptive-retrieval-strategy.js';

function makeRetriever(label: string): (q: string, k: number) => Promise<RetrievalDoc[]> {
  return async (_q: string, k: number) => {
    return Array.from({ length: k }, (_v, i) => ({
      id: `${label}-${i}`,
      score: 1 - i * 0.1,
      text: `${label} doc ${i}`,
    }));
  };
}

const fullSet: RetrieverSet = {
  bm25: makeRetriever('bm25'),
  dense: makeRetriever('dense'),
  hybrid: makeRetriever('hybrid'),
  multiHop: makeRetriever('mh'),
};

describe('AdaptiveRetrievalStrategy.classifyQuery (FR-R52.1)', () => {
  let svc: AdaptiveRetrievalStrategy;

  beforeEach(() => {
    svc = new AdaptiveRetrievalStrategy(fullSet);
  });

  it('짧은 키워드 → bm25', () => {
    const c = svc.classifyQuery('CSAP 79');
    expect(c.strategy).toBe('bm25');
    expect(c.confidence).toBeGreaterThan(0.5);
  });

  it('숫자 포함 키워드 → bm25 + 높은 confidence', () => {
    const c = svc.classifyQuery('MTU-N561 항목');
    expect(c.strategy).toBe('bm25');
    expect(c.features.hasNumber).toBe(true);
  });

  it('자연어 의문문 → dense', () => {
    const c = svc.classifyQuery('공공기관 정보보호 정책은 무엇인가요?');
    expect(c.strategy).toBe('dense');
    expect(c.features.hasInterrogative).toBe(true);
  });

  it('비교 질문 → hybrid', () => {
    const c = svc.classifyQuery('CSAP와 ISMS-P 비교 분석');
    expect(c.strategy).toBe('hybrid');
    expect(c.features.hasComparison).toBe(true);
  });

  it('추론 질문 → multi-hop', () => {
    const c = svc.classifyQuery('정책 변경의 원인과 결과는 무엇인가');
    expect(c.strategy).toBe('multi-hop');
    expect(c.features.hasReasoning).toBe(true);
  });

  it('영어 의문문 → dense', () => {
    const c = svc.classifyQuery('How does the encryption work in this system?');
    expect(c.strategy).toBe('dense');
  });
});

describe('AdaptiveRetrievalStrategy.selectStrategy (FR-R52.2)', () => {
  it('confidence 낮으면 hybrid 폴백', () => {
    const svc = new AdaptiveRetrievalStrategy(fullSet);
    const sel = svc.selectStrategy({
      strategy: 'dense',
      confidence: 0.3,
      features: { length: 10, tokenCount: 2, hasInterrogative: false, hasComparison: false, hasReasoning: false, hasNumber: false },
    });
    expect(sel.strategy).toBe('hybrid');
    expect(sel.fellBack).toBe(true);
  });

  it('confidence 높으면 분류 결과 유지', () => {
    const svc = new AdaptiveRetrievalStrategy(fullSet);
    const sel = svc.selectStrategy({
      strategy: 'bm25',
      confidence: 0.8,
      features: { length: 5, tokenCount: 2, hasInterrogative: false, hasComparison: false, hasReasoning: false, hasNumber: true },
    });
    expect(sel.strategy).toBe('bm25');
    expect(sel.fellBack).toBe(false);
  });

  it('해당 retriever 미설정 시 폴백', () => {
    const svc = new AdaptiveRetrievalStrategy({
      hybrid: makeRetriever('hybrid'),
    });
    const sel = svc.selectStrategy({
      strategy: 'bm25',
      confidence: 0.9,
      features: { length: 5, tokenCount: 2, hasInterrogative: false, hasComparison: false, hasReasoning: false, hasNumber: true },
    });
    expect(sel.strategy).toBe('hybrid');
    expect(sel.fellBack).toBe(true);
  });

  it('retriever 전혀 없으면 예외', () => {
    const svc = new AdaptiveRetrievalStrategy({});
    expect(() =>
      svc.selectStrategy({
        strategy: 'bm25',
        confidence: 0.9,
        features: { length: 5, tokenCount: 2, hasInterrogative: false, hasComparison: false, hasReasoning: false, hasNumber: false },
      }),
    ).toThrow('STRATEGY_NO_RETRIEVERS');
  });
});

describe('AdaptiveRetrievalStrategy.retrieve (FR-R52.3)', () => {
  let svc: AdaptiveRetrievalStrategy;

  beforeEach(() => {
    svc = new AdaptiveRetrievalStrategy(fullSet);
  });

  it('짧은 키워드 쿼리 → bm25 retriever 호출', async () => {
    const r = await svc.retrieve({ query: 'CSAP 79', k: 3 });
    expect(r.strategy).toBe('bm25');
    expect(r.docs).toHaveLength(3);
    expect(r.docs[0]?.id).toContain('bm25');
  });

  it('비교 쿼리 → hybrid', async () => {
    const r = await svc.retrieve({ query: 'CSAP와 ISMS-P 비교', k: 5 });
    expect(r.strategy).toBe('hybrid');
  });

  it('추론 쿼리 → multi-hop', async () => {
    const r = await svc.retrieve({ query: '정책의 원인과 결과', k: 5 });
    expect(r.strategy).toBe('multi-hop');
  });

  it('forceStrategy 지정 시 분류 무시', async () => {
    const r = await svc.retrieve({ query: 'CSAP 79', forceStrategy: 'dense' });
    expect(r.strategy).toBe('dense');
  });

  it('forceStrategy 미설정 retriever 시 예외', async () => {
    const svc2 = new AdaptiveRetrievalStrategy({ bm25: makeRetriever('bm25') });
    await expect(svc2.retrieve({ query: 'q', forceStrategy: 'dense' })).rejects.toThrow('STRATEGY_NOT_AVAILABLE');
  });
});

describe('AdaptiveRetrievalStrategy N2SF', () => {
  const svc = new AdaptiveRetrievalStrategy(fullSet);

  it('C등급 차단', async () => {
    await expect(svc.retrieve({ query: 'q', dataGrade: 'C' })).rejects.toThrow('STRATEGY_DATA_GRADE_BLOCKED');
  });

  it('S등급 차단', async () => {
    await expect(svc.retrieve({ query: 'q', dataGrade: 'S' })).rejects.toThrow('STRATEGY_DATA_GRADE_BLOCKED');
  });
});

describe('AdaptiveRetrievalStrategy.fallback (FR-R52.4)', () => {
  it('명시적 hybrid 폴백', async () => {
    const svc = new AdaptiveRetrievalStrategy(fullSet);
    const r = await svc.fallback('CSAP 79');
    expect(r.strategy).toBe('hybrid');
  });
});

describe('AdaptiveRetrievalStrategy.stats (FR-R52.5)', () => {
  it('전략별 카운터 증가', async () => {
    const svc = new AdaptiveRetrievalStrategy(fullSet);
    await svc.retrieve({ query: 'CSAP 79' }); // bm25
    await svc.retrieve({ query: '정책의 원인과 결과' }); // multi-hop
    await svc.retrieve({ query: 'a vs b 비교' }); // hybrid
    const s = svc.stats();
    expect(s.total).toBe(3);
    expect(s.bm25).toBe(1);
    expect(s.multiHop).toBe(1);
    expect(s.hybrid).toBe(1);
  });
});

describe('AdaptiveRetrievalStrategy.audit (FR-R52.6)', () => {
  it('retrieve 호출마다 감사 로그 기록', async () => {
    const svc = new AdaptiveRetrievalStrategy(fullSet);
    await svc.retrieve({ query: 'CSAP 79' });
    const log = svc.getAuditLog();
    expect(log).toHaveLength(1);
    expect(log[0]?.strategy).toBe('bm25');
    expect(log[0]?.resultCount).toBeGreaterThan(0);
  });
});
