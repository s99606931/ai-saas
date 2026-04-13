import { describe, it, expect, beforeEach } from 'vitest';
import { ServiceCatalogSearchAI } from '../service-catalog-search-ai';

describe('ServiceCatalogSearchAI', () => {
  let search: ServiceCatalogSearchAI;

  beforeEach(() => {
    search = new ServiceCatalogSearchAI();
  });

  it('카탈로그 항목을 등록한다', () => {
    search.registerItem('i1', '민원 서비스', '온라인 민원 처리', ['민원', '정부']);
    expect(search.getAuditLog().some(l => l.action === 'REGISTER_ITEM')).toBe(true);
  });

  it('제목 매칭으로 높은 점수를 부여한다', () => {
    search.registerItem('i1', '민원 서비스', '온라인 처리', ['태그1']);
    search.registerItem('i2', '복지 서비스', '민원 관련', ['태그2']);
    const results = search.search('민원');
    expect(results[0]!.id).toBe('i1');
    expect(results[0]!.score).toBeGreaterThan(results[1]!.score);
  });

  it('태그 매칭을 지원한다', () => {
    search.registerItem('i1', '기타 서비스', '내용 없음', ['민원', '처리']);
    const results = search.search('민원');
    expect(results.length).toBeGreaterThan(0);
    expect(results[0]!.matchedTerms).toContain('민원');
  });

  it('동의어 확장 검색을 지원한다', () => {
    search.registerSynonym('민원', ['complaint', '신청']);
    search.registerItem('i1', 'complaint 서비스', '설명', []);
    const results = search.search('민원');
    expect(results.some(r => r.id === 'i1')).toBe(true);
  });

  it('매칭 없으면 빈 배열을 반환한다', () => {
    search.registerItem('i1', '복지 서비스', '복지 관련', ['복지']);
    const results = search.search('xyz_no_match');
    expect(results.length).toBe(0);
  });

  it('C등급 검색을 차단한다', () => {
    expect(() => search.search('민원', 10, 'C' as never)).toThrow('BLOCKED');
  });

  it('topN 개수만큼 결과를 반환한다', () => {
    for (let i = 1; i <= 10; i++) {
      search.registerItem(`i${i}`, `서비스 ${i}`, `서비스 설명 ${i}`, ['서비스']);
    }
    const results = search.search('서비스', 3);
    expect(results.length).toBeLessThanOrEqual(3);
  });
});
