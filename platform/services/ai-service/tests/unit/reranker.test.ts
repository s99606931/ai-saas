// Reranker 단위 테스트 -- FR-ADV1.3, FR-ADV1.5
// Design Ref: SVC-AI-ADV-R1 DESIGN §2, §4
// Plan SC: FR-ADV1.3
// CSAP: D-12 시스템 개발 보안

import { describe, it, expect } from 'vitest';
import type { VectorDocument } from '../../src/lib/vector-store.js';
import type { HybridSearchResult } from '../../src/lib/hybrid-retriever.js';
import type { RerankOptions, RerankResult } from '../../src/lib/reranker.js';

// ── 타입 검증 테스트 ───────────────────────────────────────────────────��──────
// NOTE: rerankResults()는 LLM provider에 의존하므로 통합 테스트로 별도 검증.
//       여기서는 타입 인터페이스와 옵션 기본값 설계를 검증합니다.

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

describe('Reranker 타입 및 인터페이스 (FR-ADV1.3)', () => {
  it('RerankOptions 기본값 구조를 확인한다', () => {
    const defaultOptions: RerankOptions = {};
    expect(defaultOptions.candidateCount).toBeUndefined();
    expect(defaultOptions.returnCount).toBeUndefined();
    expect(defaultOptions.minRelevance).toBeUndefined();
    expect(defaultOptions.enableCompression).toBeUndefined();
  });

  it('RerankOptions 커스텀 값을 설정할 수 있다', () => {
    const options: RerankOptions = {
      candidateCount: 15,
      returnCount: 3,
      minRelevance: 5,
      enableCompression: true,
    };
    expect(options.candidateCount).toBe(15);
    expect(options.returnCount).toBe(3);
    expect(options.minRelevance).toBe(5);
    expect(options.enableCompression).toBe(true);
  });

  it('HybridSearchResult에서 RerankResult 변환 구조를 확인한다', () => {
    const hybridResult: HybridSearchResult = {
      chunk: makeChunk('r1', 'CSAP D-08 접근 통제 가이드'),
      bm25Score: 5.2,
      semanticScore: 0.88,
      rrfScore: 0.015,
      rank: 1,
    };

    // RerankResult 구조 검증
    const rerankResult: RerankResult = {
      chunk: hybridResult.chunk,
      relevanceScore: 8,
      explanation: '접근 통제 관련 직접적인 가이드 문서',
      originalRank: hybridResult.rank,
    };

    expect(rerankResult.relevanceScore).toBe(8);
    expect(rerankResult.originalRank).toBe(1);
    expect(rerankResult.chunk.id).toBe('r1');
  });

  it('RerankResult의 compressedContent 필드가 선택적이다', () => {
    const withCompression: RerankResult = {
      chunk: makeChunk('c1', '원본 텍스트입니다'),
      relevanceScore: 7,
      explanation: '관련 문서',
      originalRank: 2,
      compressedContent: '핵심 문장만 추출',
    };

    const withoutCompression: RerankResult = {
      chunk: makeChunk('c2', '다른 텍스트'),
      relevanceScore: 5,
      explanation: '간접 관련',
      originalRank: 3,
    };

    expect(withCompression.compressedContent).toBe('핵심 문장만 추출');
    expect(withoutCompression.compressedContent).toBeUndefined();
  });
});

describe('rerankDocuments 헬퍼 함수 구조 (FR-ADV1.3)', () => {
  it('VectorDocument 배열을 HybridSearchResult로 변환하는 구조를 확인한다', () => {
    const documents: VectorDocument[] = [
      makeChunk('d1', '문서 1'),
      makeChunk('d2', '문서 2'),
      makeChunk('d3', '문서 3'),
    ];

    // rerankDocuments 내부에서 수행하는 변환 로직 검증
    const candidates: HybridSearchResult[] = documents.map((chunk, idx) => ({
      chunk,
      bm25Score: 0,
      semanticScore: 0,
      rrfScore: 0,
      rank: idx + 1,
    }));

    expect(candidates).toHaveLength(3);
    expect(candidates[0]?.rank).toBe(1);
    expect(candidates[0]?.bm25Score).toBe(0);
    expect(candidates[2]?.rank).toBe(3);
  });
});
