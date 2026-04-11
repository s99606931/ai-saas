// 하이브리드 검색기 단위 테스트 -- FR-ADV1.1, FR-ADV1.2
// Design Ref: SVC-AI-ADV-R1 DESIGN §1
// Plan SC: FR-ADV1.1, FR-ADV1.2
// CSAP: D-12 시스템 개발 보안

import { describe, it, expect } from 'vitest';
import {
  tokenizeKorean,
  reciprocalRankFusion,
  type HybridSearchResult,
} from '../../src/lib/hybrid-retriever.js';
import type { VectorDocument, SearchResult } from '../../src/lib/vector-store.js';

// ── 테스트 헬퍼 ───────────────────────────���──────────────────────────────────

function makeChunk(id: string, content: string): VectorDocument {
  return {
    id,
    tenantId: 'test-tenant',
    documentId: 'doc-1',
    chunkIndex: 0,
    content,
    embedding: [],
    tokenCount: content.length,
    metadata: {},
  };
}

// ── FR-ADV1.1: 한국어 토큰화 ─────────────────────────────────────────────────

describe('tokenizeKorean (FR-ADV1.1)', () => {
  it('한국어 텍스트를 토큰으로 분할한다', () => {
    const tokens = tokenizeKorean('공공기관 SaaS 프레임워크');
    expect(tokens).toContain('공공기관');
    expect(tokens).toContain('saas');
    expect(tokens).toContain('프레임워크');
  });

  it('한국어 조사를 분리한다', () => {
    const tokens = tokenizeKorean('서비스를 제공하는 시스템에서');
    // '서비스를' -> '서비스' (조사 '를' 분리)
    expect(tokens).toContain('서비스');
    // '시스템에서' -> '시스템' (조사 '에서' 분리)
    expect(tokens).toContain('시스템');
  });

  it('불용어를 제거한다', () => {
    const tokens = tokenizeKorean('이 그 저 것은 필요하다');
    // '이', '그', '저'는 불용어
    expect(tokens).not.toContain('이');
    expect(tokens).not.toContain('그');
    expect(tokens).not.toContain('저');
  });

  it('특수문자를 제거한다', () => {
    const tokens = tokenizeKorean('CSAP(D-08) 접근 통제!!');
    // 특수문자 제거 후 토큰 생성
    expect(tokens.some((t) => t.includes('csap'))).toBe(true);
  });

  it('2-gram 바이그램을 생성한다', () => {
    const tokens = tokenizeKorean('공공기관 데이터 보안');
    // '공공기관_데이터' 또는 '데이터_보안' 바이그램이 생성되어야 함
    const bigrams = tokens.filter((t) => t.includes('_'));
    expect(bigrams.length).toBeGreaterThan(0);
  });

  it('빈 문자열을 처리한다', () => {
    const tokens = tokenizeKorean('');
    expect(tokens).toEqual([]);
  });

  it('영문 소문자로 변환한다', () => {
    const tokens = tokenizeKorean('CSAP 인증');
    expect(tokens.some((t) => t === 'csap')).toBe(true);
  });

  it('한 글자 토큰을 필터링한다', () => {
    const tokens = tokenizeKorean('나 는 학 생');
    // 한 글자 토큰은 필터링됨
    const singleChar = tokens.filter((t) => !t.includes('_') && t.length <= 1);
    expect(singleChar).toHaveLength(0);
  });
});

// ── FR-ADV1.2: RRF 융합 ──────────────────────────────��───────────────────────

describe('reciprocalRankFusion (FR-ADV1.2)', () => {
  it('BM25와 시맨틱 결과를 RRF로 융합한다', () => {
    const bm25Results = [
      { chunk: makeChunk('c1', 'CSAP 접근 통제'), score: 5.2 },
      { chunk: makeChunk('c2', 'N2SF 데이터 분류'), score: 3.1 },
    ];

    const semanticResults: SearchResult[] = [
      { chunk: makeChunk('c2', 'N2SF 데이터 분류'), score: 0.95 },
      { chunk: makeChunk('c3', '보안 감사 로그'), score: 0.88 },
    ];

    const results = reciprocalRankFusion(bm25Results, semanticResults);

    // 결과가 반환되어야 함
    expect(results.length).toBeGreaterThan(0);

    // c2가 두 검색에 모두 나타나므로 RRF 점수가 가장 높아야 함
    expect(results[0]?.chunk.id).toBe('c2');
  });

  it('RRF 점수가 내림차순으로 정렬된다', () => {
    const bm25Results = [
      { chunk: makeChunk('a', 'doc A'), score: 10 },
      { chunk: makeChunk('b', 'doc B'), score: 8 },
      { chunk: makeChunk('c', 'doc C'), score: 5 },
    ];

    const semanticResults: SearchResult[] = [
      { chunk: makeChunk('c', 'doc C'), score: 0.99 },
      { chunk: makeChunk('b', 'doc B'), score: 0.90 },
      { chunk: makeChunk('d', 'doc D'), score: 0.80 },
    ];

    const results = reciprocalRankFusion(bm25Results, semanticResults);

    for (let i = 1; i < results.length; i++) {
      const prev = results[i - 1];
      const curr = results[i];
      if (prev && curr) {
        expect(prev.rrfScore).toBeGreaterThanOrEqual(curr.rrfScore);
      }
    }
  });

  it('rank 필드가 1부터 순차 부여된다', () => {
    const bm25Results = [
      { chunk: makeChunk('x', 'test'), score: 1 },
    ];
    const semanticResults: SearchResult[] = [
      { chunk: makeChunk('y', 'test2'), score: 0.5 },
    ];

    const results = reciprocalRankFusion(bm25Results, semanticResults);

    results.forEach((r, idx) => {
      expect(r.rank).toBe(idx + 1);
    });
  });

  it('빈 결과를 처리한다', () => {
    const results = reciprocalRankFusion([], []);
    expect(results).toEqual([]);
  });

  it('BM25만 있는 결과를 처리한다', () => {
    const bm25Results = [
      { chunk: makeChunk('only-bm25', 'keyword match'), score: 3.0 },
    ];

    const results = reciprocalRankFusion(bm25Results, []);
    expect(results).toHaveLength(1);
    expect(results[0]?.bm25Score).toBe(3.0);
    expect(results[0]?.semanticScore).toBe(0);
  });

  it('시맨틱만 있는 결과를 처리한다', () => {
    const semanticResults: SearchResult[] = [
      { chunk: makeChunk('only-sem', 'semantic match'), score: 0.92 },
    ];

    const results = reciprocalRankFusion([], semanticResults);
    expect(results).toHaveLength(1);
    expect(results[0]?.semanticScore).toBe(0.92);
    expect(results[0]?.bm25Score).toBe(0);
  });

  it('가중치를 반영한다', () => {
    const bm25Results = [
      { chunk: makeChunk('c1', 'bm25 only'), score: 10 },
    ];
    const semanticResults: SearchResult[] = [
      { chunk: makeChunk('c2', 'semantic only'), score: 0.99 },
    ];

    // BM25 가중치 높게
    const bm25Heavy = reciprocalRankFusion(bm25Results, semanticResults, 0.9, 0.1);
    // 시맨틱 가중치 높게
    const semHeavy = reciprocalRankFusion(bm25Results, semanticResults, 0.1, 0.9);

    // BM25 가중치 높으면 c1이 첫번째
    expect(bm25Heavy[0]?.chunk.id).toBe('c1');
    // 시맨틱 가중치 높으면 c2가 첫번째
    expect(semHeavy[0]?.chunk.id).toBe('c2');
  });

  it('동일 문서의 BM25/시맨틱 점수를 모두 보존한다', () => {
    const chunk = makeChunk('shared', '공유 문서');
    const bm25Results = [{ chunk, score: 7.5 }];
    const semanticResults: SearchResult[] = [{ chunk, score: 0.88 }];

    const results = reciprocalRankFusion(bm25Results, semanticResults);
    expect(results).toHaveLength(1);
    expect(results[0]?.bm25Score).toBe(7.5);
    expect(results[0]?.semanticScore).toBe(0.88);
    expect(results[0]?.rrfScore).toBeGreaterThan(0);
  });
});
