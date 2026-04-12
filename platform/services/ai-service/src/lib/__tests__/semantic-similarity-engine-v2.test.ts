import { describe, it, expect } from 'vitest';
import { SemanticSimilarityEngineV2, type Document } from '../semantic-similarity-engine-v2.js';

const corpus: Document[] = [
  { id: 'd1', text: 'korea public service ai', vector: [1, 0, 0] },
  { id: 'd2', text: 'cloud security framework', vector: [0, 1, 0] },
  { id: 'd3', text: 'public ai platform korea', vector: [0.9, 0.1, 0] },
];

describe('SVC-AI-ADV-R362 SemanticSimilarityEngineV2', () => {
  const svc = new SemanticSimilarityEngineV2();

  it('FR-362.1: 코사인+BM25 앙상블', () => {
    const hits = svc.search({ text: 'public ai korea', vector: [1, 0, 0] }, corpus, 3);
    expect(hits.length).toBe(3);
    expect(hits[0]?.cosine).toBeGreaterThan(0);
  });

  it('FR-362.2: topK 정렬', () => {
    const hits = svc.search({ text: 'korea ai', vector: [1, 0, 0] }, corpus, 2);
    expect(hits.length).toBe(2);
    expect(hits[0]?.score ?? 0).toBeGreaterThanOrEqual(hits[1]?.score ?? 0);
  });

  it('FR-362.3: S등급 차단', () => {
    expect(() =>
      svc.search({ text: 'korea', vector: [1, 0, 0] }, corpus, 3, 0.6, 'S'),
    ).toThrow('N2SF_BLOCKED');
  });

  it('FR-362.4: 감사 로그', () => {
    svc.search({ text: 'korea', vector: [1, 0, 0] }, corpus, 3);
    expect(svc.getAuditLog().length).toBeGreaterThan(0);
  });

  it('cosineWeight 범위', () => {
    expect(() => svc.search({ text: 'x', vector: [1] }, corpus, 3, 2)).toThrow('INVALID_PARAMS');
  });
});
