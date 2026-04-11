// SaaS 카탈로그 인메모리 저장소 단위 테스트
// Design Ref: SVC-SAASCAT-R3 DESIGN
// Plan SC: FR-SCAT.1
// CSAP: D-08-05 테넌트 격리

import { describe, it, expect, beforeEach } from 'vitest';
import {
  createItem,
  getItem,
  listItems,
  updateItem,
  deleteItem,
  getStats,
  clearStore,
} from '../../src/lib/store.js';

describe('SaaS 카탈로그 저장소', () => {
  const tenantA = 'tenant-a';
  const tenantB = 'tenant-b';

  const baseData = {
    name: 'AI 분석 도구',
    description: '공공기관 AI 데이터 분석',
    category: 'AI_ML' as const,
    provider: '테스트 제공자',
    version: '1.0.0',
    csapGrade: 'STANDARD' as const,
    tags: ['AI', '분석'],
    pricing: '무료',
    documentationUrl: 'https://docs.example.com',
    createdBy: 'user-1',
    updatedBy: 'user-1',
  };

  beforeEach(() => {
    clearStore();
  });

  // -- createItem ───────────────────────────────────────────────────────

  describe('createItem', () => {
    it('항목을 생성한다', () => {
      const item = createItem(tenantA, baseData);
      expect(item.id).toBeTruthy();
      expect(item.tenantId).toBe(tenantA);
      expect(item.status).toBe('DRAFT');
      expect(item.deletedAt).toBeNull();
      expect(item.name).toBe('AI 분석 도구');
    });

    it('고유 ID를 생성한다', () => {
      const item1 = createItem(tenantA, baseData);
      const item2 = createItem(tenantA, baseData);
      expect(item1.id).not.toBe(item2.id);
    });
  });

  // -- getItem (테넌트 격리) ────────────────────────────────────────────

  describe('getItem (CSAP D-08-05 테넌트 격리)', () => {
    it('같은 테넌트의 항목을 조회한다', () => {
      const created = createItem(tenantA, baseData);
      const found = getItem(created.id, tenantA);
      expect(found).not.toBeNull();
      expect(found!.id).toBe(created.id);
    });

    it('다른 테넌트의 항목은 조회할 수 없다', () => {
      const created = createItem(tenantA, baseData);
      const found = getItem(created.id, tenantB);
      expect(found).toBeNull();
    });

    it('존재하지 않는 항목은 null', () => {
      expect(getItem('nonexistent', tenantA)).toBeNull();
    });

    it('삭제된 항목은 null', () => {
      const created = createItem(tenantA, baseData);
      deleteItem(created.id, tenantA);
      expect(getItem(created.id, tenantA)).toBeNull();
    });
  });

  // -- listItems ────────────────────────────────────────────────────────

  describe('listItems', () => {
    const defaultOpts = { page: 1, limit: 20, sort: 'createdAt' as const, order: 'desc' as const };

    it('테넌트별 항목을 나열한다', () => {
      createItem(tenantA, baseData);
      createItem(tenantA, { ...baseData, name: '두번째' });
      createItem(tenantB, baseData);

      const result = listItems(tenantA, defaultOpts);
      expect(result.total).toBe(2);
      expect(result.items).toHaveLength(2);
    });

    it('카테고리 필터를 적용한다', () => {
      createItem(tenantA, { ...baseData, category: 'AI_ML' });
      createItem(tenantA, { ...baseData, name: '보안 도구', category: 'SECURITY' });

      const result = listItems(tenantA, { ...defaultOpts, category: 'SECURITY' });
      expect(result.total).toBe(1);
      expect(result.items[0]!.category).toBe('SECURITY');
    });

    it('상태 필터를 적용한다', () => {
      const item = createItem(tenantA, baseData);
      updateItem(item.id, tenantA, { status: 'APPROVED' });
      createItem(tenantA, baseData);

      const result = listItems(tenantA, { ...defaultOpts, status: 'APPROVED' });
      expect(result.total).toBe(1);
    });

    it('검색어로 필터링한다', () => {
      createItem(tenantA, { ...baseData, name: 'AI 분석 도구' });
      createItem(tenantA, { ...baseData, name: '보안 감사 서비스', description: '보안 감사' });

      const result = listItems(tenantA, { ...defaultOpts, search: '보안' });
      expect(result.total).toBe(1);
    });

    it('페이지네이션을 적용한다', () => {
      for (let i = 0; i < 5; i++) {
        createItem(tenantA, { ...baseData, name: `항목 ${i}` });
      }

      const page1 = listItems(tenantA, { ...defaultOpts, page: 1, limit: 2 });
      expect(page1.items).toHaveLength(2);
      expect(page1.totalPages).toBe(3);

      const page3 = listItems(tenantA, { ...defaultOpts, page: 3, limit: 2 });
      expect(page3.items).toHaveLength(1);
    });

    it('이름순 정렬을 적용한다', () => {
      createItem(tenantA, { ...baseData, name: 'C 서비스' });
      createItem(tenantA, { ...baseData, name: 'A 서비스' });
      createItem(tenantA, { ...baseData, name: 'B 서비스' });

      const result = listItems(tenantA, { ...defaultOpts, sort: 'name', order: 'asc' });
      expect(result.items[0]!.name).toBe('A 서비스');
      expect(result.items[2]!.name).toBe('C 서비스');
    });

    it('삭제된 항목은 제외된다', () => {
      const item = createItem(tenantA, baseData);
      createItem(tenantA, { ...baseData, name: '두번째' });
      deleteItem(item.id, tenantA);

      const result = listItems(tenantA, defaultOpts);
      expect(result.total).toBe(1);
    });
  });

  // -- updateItem ───────────────────────────────────────────────────────

  describe('updateItem', () => {
    it('항목을 수정한다', () => {
      const created = createItem(tenantA, baseData);
      const updated = updateItem(created.id, tenantA, { name: '수정됨' });
      expect(updated).not.toBeNull();
      expect(updated!.name).toBe('수정됨');
      expect(updated!.updatedAt).toBeTruthy();
      expect(updated!.createdAt).toBe(created.createdAt); // createdAt 불변
    });

    it('다른 테넌트의 항목은 수정할 수 없다', () => {
      const created = createItem(tenantA, baseData);
      expect(updateItem(created.id, tenantB, { name: '해킹' })).toBeNull();
    });

    it('ID와 tenantId는 변경할 수 없다', () => {
      const created = createItem(tenantA, baseData);
      const updated = updateItem(created.id, tenantA, {
        id: 'hacked-id',
        tenantId: 'hacked-tenant',
      } as Partial<import('../../src/schemas/catalog.schema.js').SaasCatalogItem>);
      expect(updated!.id).toBe(created.id);
      expect(updated!.tenantId).toBe(tenantA);
    });
  });

  // -- deleteItem ───────────────────────────────────────────────────────

  describe('deleteItem', () => {
    it('DRAFT 상태의 항목을 삭제한다', () => {
      const created = createItem(tenantA, baseData);
      expect(deleteItem(created.id, tenantA)).toBe(true);
      expect(getItem(created.id, tenantA)).toBeNull();
    });

    it('DRAFT가 아닌 항목은 삭제할 수 없다', () => {
      const created = createItem(tenantA, baseData);
      updateItem(created.id, tenantA, { status: 'APPROVED' });
      expect(deleteItem(created.id, tenantA)).toBe(false);
    });

    it('다른 테넌트의 항목은 삭제할 수 없다', () => {
      const created = createItem(tenantA, baseData);
      expect(deleteItem(created.id, tenantB)).toBe(false);
    });
  });

  // -- getStats ─────────────────────────────────────────────────────────

  describe('getStats', () => {
    it('테넌트별 통계를 반환한다', () => {
      createItem(tenantA, { ...baseData, category: 'AI_ML' });
      createItem(tenantA, { ...baseData, category: 'SECURITY' });
      const item3 = createItem(tenantA, { ...baseData, category: 'AI_ML' });
      updateItem(item3.id, tenantA, { status: 'APPROVED' });

      const stats = getStats(tenantA);
      expect(stats.total).toBe(3);
      expect(stats.byCategory['AI_ML']).toBe(2);
      expect(stats.byCategory['SECURITY']).toBe(1);
      expect(stats.byStatus['DRAFT']).toBe(2);
      expect(stats.byStatus['APPROVED']).toBe(1);
    });

    it('빈 테넌트의 통계', () => {
      const stats = getStats('empty-tenant');
      expect(stats.total).toBe(0);
    });
  });
});
