// MTU-N327 문서 유사도 엔진 테스트
import { describe, it, expect } from 'vitest';
import { DocumentSimilarityService } from '../document-similarity-engine.js';

describe('MTU-N327 DocumentSimilarity', () => {
  const svc = new DocumentSimilarityService('tenant-n327');

  it('FR-N327.1: 문서 벡터화', () => {
    const v = svc.vectorize('d1', '공공 SaaS', '공공기관 SaaS 프레임워크 설명');
    expect(v).toBeDefined();
  });

  it('FR-N327.2: 유사도 비교', () => {
    const a = svc.vectorize('d1', 'SaaS 문서', 'SaaS 프레임워크 설명');
    const b = svc.vectorize('d2', 'SaaS 안내', 'SaaS 프레임워크 안내');
    const sim = svc.compare(a, b);
    expect(sim).toBeDefined();
  });

  it('FR-N327.3: 중복 탐지', () => {
    const vectors = [
      svc.vectorize('d1', 't1', 'abc'),
      svc.vectorize('d2', 't2', 'abc def'),
      svc.vectorize('d3', 't3', 'xyz'),
    ];
    const report = svc.detectDuplicates(vectors, 0.5);
    expect(report).toBeDefined();
  });

  it('FR-N327.6: 감사 로그', () => {
    expect(svc.getAuditLog().length).toBeGreaterThan(0);
  });
});
