// Pagination -- Cursor/Offset 기반 페이지네이션
// Design Ref: SVC-PAGINATION-R32 DESIGN
// Plan SC: FR-PG.1, FR-PG.2, FR-PG.3, FR-PG.4, FR-PG.5, FR-PG.6

/**
 * 정렬 방향
 * Plan SC: FR-PG.4
 */
export type SortOrder = 'asc' | 'desc';

/**
 * 페이지네이션 메타데이터
 * Plan SC: FR-PG.3
 */
export interface PaginationMeta {
  total: number;
  limit: number;
  hasNext: boolean;
  hasPrevious: boolean;
  nextCursor: string | null;
  previousCursor: string | null;
}

/**
 * 페이지네이션 결과
 */
export interface PaginatedResult<T> {
  data: T[];
  pagination: PaginationMeta;
}

/**
 * Cursor 페이로드 (인코딩/디코딩용)
 * Plan SC: FR-PG.5
 */
interface CursorPayload {
  id: string;
  sortValue?: unknown;
}

/**
 * Cursor를 Base64로 인코딩합니다.
 * Plan SC: FR-PG.5
 */
export function encodeCursor(id: string, sortValue?: unknown): string {
  const payload: CursorPayload = { id };
  if (sortValue !== undefined) {
    payload.sortValue = sortValue;
  }
  return Buffer.from(JSON.stringify(payload), 'utf-8').toString('base64url');
}

/**
 * Base64 Cursor를 디코딩합니다.
 * Plan SC: FR-PG.5
 */
export function decodeCursor(cursor: string): CursorPayload | null {
  try {
    const json = Buffer.from(cursor, 'base64url').toString('utf-8');
    const parsed = JSON.parse(json) as CursorPayload;

    if (typeof parsed.id !== 'string') {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

/**
 * 배열에 Cursor 기반 페이지네이션을 적용합니다.
 * Plan SC: FR-PG.1, FR-PG.3, FR-PG.6
 *
 * @param items 전체 정렬된 아이템 배열
 * @param options 페이지네이션 옵션
 * @param getId 아이템에서 ID를 추출하는 함수
 */
export function paginateWithCursor<T>(
  items: T[],
  options: {
    limit: number;
    after?: string | null;
    before?: string | null;
  },
  getId: (item: T) => string,
): PaginatedResult<T> {
  const { limit, after, before } = options;
  const total = items.length;

  // 빈 결과 (FR-PG.6)
  if (total === 0) {
    return {
      data: [],
      pagination: {
        total: 0,
        limit,
        hasNext: false,
        hasPrevious: false,
        nextCursor: null,
        previousCursor: null,
      },
    };
  }

  let startIndex = 0;

  // after cursor: 해당 ID 다음부터
  if (after) {
    const decoded = decodeCursor(after);
    if (decoded) {
      const idx = items.findIndex((item) => getId(item) === decoded.id);
      if (idx >= 0) {
        startIndex = idx + 1;
      }
    }
  }

  // before cursor: 해당 ID 이전까지 (역방향)
  if (before) {
    const decoded = decodeCursor(before);
    if (decoded) {
      const idx = items.findIndex((item) => getId(item) === decoded.id);
      if (idx >= 0) {
        startIndex = Math.max(0, idx - limit);
      }
    }
  }

  const endIndex = Math.min(startIndex + limit, total);
  const data = items.slice(startIndex, endIndex);

  const hasNext = endIndex < total;
  const hasPrevious = startIndex > 0;

  const nextCursor = hasNext && data.length > 0
    ? encodeCursor(getId(data[data.length - 1]))
    : null;

  const previousCursor = hasPrevious && data.length > 0
    ? encodeCursor(getId(data[0]))
    : null;

  return {
    data,
    pagination: {
      total,
      limit,
      hasNext,
      hasPrevious,
      nextCursor,
      previousCursor,
    },
  };
}

/**
 * 배열에 Offset 기반 페이지네이션을 적용합니다.
 * Plan SC: FR-PG.2, FR-PG.3, FR-PG.6
 */
export function paginateWithOffset<T>(
  items: T[],
  options: {
    page: number;
    limit: number;
  },
): PaginatedResult<T> {
  const { page, limit } = options;
  const total = items.length;

  // 빈 결과 (FR-PG.6)
  if (total === 0) {
    return {
      data: [],
      pagination: {
        total: 0,
        limit,
        hasNext: false,
        hasPrevious: false,
        nextCursor: null,
        previousCursor: null,
      },
    };
  }

  const offset = (page - 1) * limit;
  const data = items.slice(offset, offset + limit);

  return {
    data,
    pagination: {
      total,
      limit,
      hasNext: offset + limit < total,
      hasPrevious: page > 1,
      nextCursor: null,
      previousCursor: null,
    },
  };
}

/**
 * 배열을 정렬합니다.
 * Plan SC: FR-PG.4
 */
export function sortItems<T>(
  items: T[],
  sortBy: keyof T,
  sortOrder: SortOrder = 'asc',
): T[] {
  return [...items].sort((a, b) => {
    const aVal = a[sortBy];
    const bVal = b[sortBy];

    if (aVal === bVal) return 0;
    if (aVal === null || aVal === undefined) return 1;
    if (bVal === null || bVal === undefined) return -1;

    const comparison = aVal < bVal ? -1 : 1;
    return sortOrder === 'asc' ? comparison : -comparison;
  });
}
