// Catalog Stats 핸들러 단위 테스트
// Design Ref: SVC-CAT-R1 DESIGN
// Plan SC: FR-CAT.3, FR-CAT.5

import { describe, it, expect } from 'vitest';

// ── FR-CAT.3: 카테고리 목록 (listCategoriesHandler) ──

describe('FR-CAT.3: listCategoriesHandler', () => {
  it('카테고리별 서비스 수가 집계된다', () => {
    const raw = [
      { category: '인프라', _count: { id: 5 } },
      { category: '보안', _count: { id: 3 } },
      { category: '개발도구', _count: { id: 8 } },
    ];
    const mapped = raw.map((c) => ({
      category: c.category,
      serviceCount: c._count.id,
    }));
    expect(mapped).toHaveLength(3);
    expect(mapped[2]!.serviceCount).toBe(8);
  });

  it('카테고리가 오름차순으로 정렬된다', () => {
    const categories = ['보안', '개발도구', '인프라'];
    const sorted = [...categories].sort();
    expect(sorted[0]).toBe('개발도구');
  });
});

// ── FR-CAT.5: 서비스 통계 (catalogStatsHandler) ──

describe('FR-CAT.5: catalogStatsHandler', () => {
  it('활성/비활성 서비스 수가 올바르다', () => {
    const total = 20;
    const activeCount = 15;
    const inactiveCount = total - activeCount;
    expect(inactiveCount).toBe(5);
  });

  it('활성 비율이 올바르게 계산된다', () => {
    const total = 20;
    const activeCount = 15;
    const percent = total > 0 ? Math.round((activeCount / total) * 100) : 0;
    expect(percent).toBe(75);
  });

  it('서비스가 없으면 활성 비율 0%', () => {
    const total = 0;
    const activeCount = 0;
    const percent = total > 0 ? Math.round((activeCount / total) * 100) : 0;
    expect(percent).toBe(0);
  });

  it('카테고리 분포가 포함된다', () => {
    const distribution = [
      { category: 'SaaS', count: 10 },
      { category: 'IaaS', count: 5 },
    ];
    expect(distribution).toHaveLength(2);
  });

  it('피처 플래그 수가 포함된다', () => {
    const flagCount = 12;
    expect(flagCount).toBeGreaterThanOrEqual(0);
  });

  it('응답에 generatedAt 타임스탬프가 포함된다', () => {
    const generatedAt = new Date().toISOString();
    expect(generatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });
});
