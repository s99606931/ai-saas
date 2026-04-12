import { describe, it, expect, beforeEach } from 'vitest';
import { EnterpriseSearchAi } from '../enterprise-search-ai.js';

describe('EnterpriseSearchAi', () => {
  let search: EnterpriseSearchAi;

  beforeEach(() => {
    search = new EnterpriseSearchAi();
    search.index({
      id: 'd1',
      title: '예산 편성 지침',
      body: '2026년 예산 편성 절차 및 감사 기준. 문의 010-1234-5678',
      tags: ['예산'],
      acl: ['finance'],
      updatedAt: '2026-04-01',
    });
    search.index({
      id: 'd2',
      title: '민원 처리 매뉴얼',
      body: '민원인 접수, 분류, 처리 SLA 기준 안내',
      tags: ['민원'],
      acl: [],
      updatedAt: '2026-04-05',
    });
  });

  it('BM25 검색 점수', () => {
    const r = search.search({ text: '예산', principalGroups: ['finance'], topK: 5 });
    expect(r.length).toBeGreaterThan(0);
    expect(r[0]?.doc.id).toBe('d1');
  });

  it('ACL 필터링', () => {
    const r = search.search({ text: '예산', principalGroups: ['external'], topK: 5 });
    expect(r.find((x) => x.doc.id === 'd1')).toBeUndefined();
  });

  it('PII 마스킹', () => {
    const r = search.search({ text: '예산', principalGroups: ['finance'], topK: 5 });
    expect(r[0]?.doc.body).not.toContain('010-1234-5678');
  });

  it('하이라이팅', () => {
    const r = search.search({ text: '민원', principalGroups: [], topK: 5 });
    expect(r[0]?.highlights.length).toBeGreaterThan(0);
  });

  it('쿼리 재작성(시노님)', () => {
    const r = search.search({ text: '민원인', principalGroups: [], topK: 5 });
    expect(r[0]?.doc.id).toBe('d2');
  });

  it('빈 문서 거부', () => {
    expect(() =>
      search.index({ id: 'x', title: 't', body: '   ', tags: [], acl: [], updatedAt: '' }),
    ).toThrow('SEARCH_EMPTY_DOC');
  });
});
