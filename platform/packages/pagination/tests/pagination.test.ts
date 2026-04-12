// Pagination 테스트
// Design Ref: SVC-PAGINATION-R32 DESIGN
// Plan SC: FR-PG.1~FR-PG.6

import { describe, it, expect } from 'vitest';
import {
  paginateWithCursor,
  paginateWithOffset,
  sortItems,
  encodeCursor,
  decodeCursor,
} from '../src/pagination.js';

interface Item {
  id: string;
  name: string;
  score: number;
}

const items: Item[] = Array.from({ length: 10 }, (_, i) => ({
  id: `item-${i + 1}`,
  name: `Item ${i + 1}`,
  score: (i + 1) * 10,
}));

describe('Pagination', () => {
  describe('FR-PG.1: Cursor 기반 페이지네이션', () => {
    it('첫 페이지를 반환한다', () => {
      const result = paginateWithCursor(items, { limit: 3 }, (i) => i.id);

      expect(result.data).toHaveLength(3);
      expect(result.data[0].id).toBe('item-1');
      expect(result.data[2].id).toBe('item-3');
      expect(result.pagination.hasNext).toBe(true);
      expect(result.pagination.hasPrevious).toBe(false);
    });

    it('after cursor로 다음 페이지를 반환한다', () => {
      const cursor = encodeCursor('item-3');
      const result = paginateWithCursor(
        items,
        { limit: 3, after: cursor },
        (i) => i.id,
      );

      expect(result.data[0].id).toBe('item-4');
      expect(result.data[2].id).toBe('item-6');
      expect(result.pagination.hasPrevious).toBe(true);
      expect(result.pagination.hasNext).toBe(true);
    });

    it('마지막 페이지에서 hasNext가 false이다', () => {
      const cursor = encodeCursor('item-8');
      const result = paginateWithCursor(
        items,
        { limit: 5, after: cursor },
        (i) => i.id,
      );

      expect(result.data).toHaveLength(2);
      expect(result.pagination.hasNext).toBe(false);
    });
  });

  describe('FR-PG.2: Offset 기반 페이지네이션', () => {
    it('page/limit로 페이지를 반환한다', () => {
      const result = paginateWithOffset(items, { page: 1, limit: 3 });

      expect(result.data).toHaveLength(3);
      expect(result.data[0].id).toBe('item-1');
      expect(result.pagination.hasNext).toBe(true);
      expect(result.pagination.hasPrevious).toBe(false);
    });

    it('page 2를 올바르게 반환한다', () => {
      const result = paginateWithOffset(items, { page: 2, limit: 3 });

      expect(result.data[0].id).toBe('item-4');
      expect(result.pagination.hasPrevious).toBe(true);
    });

    it('마지막 페이지를 올바르게 반환한다', () => {
      const result = paginateWithOffset(items, { page: 4, limit: 3 });

      expect(result.data).toHaveLength(1);
      expect(result.data[0].id).toBe('item-10');
      expect(result.pagination.hasNext).toBe(false);
    });
  });

  describe('FR-PG.3: 페이지 메타데이터', () => {
    it('total을 정확히 반환한다', () => {
      const result = paginateWithCursor(items, { limit: 3 }, (i) => i.id);
      expect(result.pagination.total).toBe(10);
    });

    it('limit을 정확히 반환한다', () => {
      const result = paginateWithOffset(items, { page: 1, limit: 5 });
      expect(result.pagination.limit).toBe(5);
    });

    it('nextCursor/previousCursor를 반환한다', () => {
      const result = paginateWithCursor(items, { limit: 3 }, (i) => i.id);

      expect(result.pagination.nextCursor).not.toBeNull();
      expect(result.pagination.previousCursor).toBeNull();
    });
  });

  describe('FR-PG.4: 정렬', () => {
    it('오름차순 정렬한다', () => {
      const unsorted: Item[] = [
        { id: '3', name: 'C', score: 30 },
        { id: '1', name: 'A', score: 10 },
        { id: '2', name: 'B', score: 20 },
      ];

      const sorted = sortItems(unsorted, 'name', 'asc');
      expect(sorted[0].name).toBe('A');
      expect(sorted[1].name).toBe('B');
      expect(sorted[2].name).toBe('C');
    });

    it('내림차순 정렬한다', () => {
      const sorted = sortItems(items, 'score', 'desc');
      expect(sorted[0].score).toBe(100);
      expect(sorted[9].score).toBe(10);
    });

    it('원본 배열을 변경하지 않는다', () => {
      const original = [...items];
      sortItems(items, 'score', 'desc');
      expect(items).toEqual(original);
    });
  });

  describe('FR-PG.5: Cursor 인코딩/디코딩', () => {
    it('Cursor를 인코딩하고 디코딩한다', () => {
      const cursor = encodeCursor('item-5');
      const decoded = decodeCursor(cursor);

      expect(decoded).not.toBeNull();
      expect(decoded!.id).toBe('item-5');
    });

    it('sortValue를 포함할 수 있다', () => {
      const cursor = encodeCursor('item-5', 50);
      const decoded = decodeCursor(cursor);

      expect(decoded!.sortValue).toBe(50);
    });

    it('잘못된 Cursor는 null을 반환한다', () => {
      expect(decodeCursor('invalid-base64')).toBeNull();
      expect(decodeCursor('')).toBeNull();
    });

    it('변조된 Cursor는 null을 반환한다', () => {
      // 유효한 base64이지만 구조가 잘못된 경우
      const badCursor = Buffer.from('{"wrong":"field"}').toString('base64url');
      expect(decodeCursor(badCursor)).toBeNull();
    });
  });

  describe('FR-PG.6: 빈 결과', () => {
    it('빈 배열에 대한 Cursor 페이지네이션', () => {
      const result = paginateWithCursor([], { limit: 10 }, (i: Item) => i.id);

      expect(result.data).toHaveLength(0);
      expect(result.pagination.total).toBe(0);
      expect(result.pagination.hasNext).toBe(false);
      expect(result.pagination.hasPrevious).toBe(false);
      expect(result.pagination.nextCursor).toBeNull();
    });

    it('빈 배열에 대한 Offset 페이지네이션', () => {
      const result = paginateWithOffset([], { page: 1, limit: 10 });

      expect(result.data).toHaveLength(0);
      expect(result.pagination.total).toBe(0);
    });
  });
});
