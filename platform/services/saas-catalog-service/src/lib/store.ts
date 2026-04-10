// 인메모리 카탈로그 저장소
// Design Ref: SVC-SAASCAT-R3 DESIGN -- 저장소
// Plan SC: FR-SCAT.1
// NOTE: 프로덕션 시 Prisma 기반으로 전환 예정

import type { SaasCatalogItem, CatalogCategory, CatalogStatus } from '../schemas/catalog.schema.js';

/** 인메모리 저장소 */
const store = new Map<string, SaasCatalogItem>();
let idCounter = 0;

/** ID 생성 */
function generateId(): string {
  idCounter += 1;
  return `scat-${Date.now()}-${idCounter}`;
}

/** 항목 생성 */
export function createItem(
  tenantId: string,
  data: Omit<SaasCatalogItem, 'id' | 'tenantId' | 'status' | 'rejectionReason' | 'createdAt' | 'updatedAt' | 'deletedAt'>,
): SaasCatalogItem {
  const now = new Date().toISOString();
  const item: SaasCatalogItem = {
    id: generateId(),
    tenantId,
    ...data,
    status: 'DRAFT',
    rejectionReason: null,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
  };
  store.set(item.id, item);
  return item;
}

/** 항목 조회 (테넌트 격리 -- CSAP D-08-05) */
export function getItem(id: string, tenantId: string): SaasCatalogItem | null {
  const item = store.get(id);
  if (!item || item.tenantId !== tenantId || item.deletedAt !== null) {
    return null;
  }
  return item;
}

/** 목록 조회 (테넌트 격리 + 필터 + 페이지네이션) */
export function listItems(
  tenantId: string,
  options: {
    page: number;
    limit: number;
    category?: CatalogCategory;
    status?: CatalogStatus;
    search?: string;
    sort: 'name' | 'createdAt' | 'updatedAt';
    order: 'asc' | 'desc';
  },
): { items: SaasCatalogItem[]; total: number; page: number; limit: number; totalPages: number } {
  let items = Array.from(store.values()).filter(
    (item) => item.tenantId === tenantId && item.deletedAt === null,
  );

  // 카테고리 필터
  if (options.category) {
    items = items.filter((item) => item.category === options.category);
  }

  // 상태 필터
  if (options.status) {
    items = items.filter((item) => item.status === options.status);
  }

  // 검색 (이름 + 설명)
  if (options.search) {
    const keyword = options.search.toLowerCase();
    items = items.filter(
      (item) =>
        item.name.toLowerCase().includes(keyword) ||
        item.description.toLowerCase().includes(keyword),
    );
  }

  // 정렬
  items.sort((a, b) => {
    const aVal = a[options.sort];
    const bVal = b[options.sort];
    const cmp = aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
    return options.order === 'asc' ? cmp : -cmp;
  });

  const total = items.length;
  const totalPages = Math.ceil(total / options.limit);
  const start = (options.page - 1) * options.limit;
  const paginated = items.slice(start, start + options.limit);

  return { items: paginated, total, page: options.page, limit: options.limit, totalPages };
}

/** 항목 수정 */
export function updateItem(
  id: string,
  tenantId: string,
  data: Partial<SaasCatalogItem>,
): SaasCatalogItem | null {
  const item = getItem(id, tenantId);
  if (!item) return null;

  const updated = {
    ...item,
    ...data,
    id: item.id,
    tenantId: item.tenantId,
    createdAt: item.createdAt,
    updatedAt: new Date().toISOString(),
  };
  store.set(id, updated);
  return updated;
}

/** 소프트 삭제 */
export function deleteItem(id: string, tenantId: string): boolean {
  const item = getItem(id, tenantId);
  if (!item || item.status !== 'DRAFT') return false;

  item.deletedAt = new Date().toISOString();
  store.set(id, item);
  return true;
}

/** 통계 (테넌트별) */
export function getStats(tenantId: string): {
  byStatus: Record<string, number>;
  byCategory: Record<string, number>;
  total: number;
} {
  const items = Array.from(store.values()).filter(
    (item) => item.tenantId === tenantId && item.deletedAt === null,
  );

  const byStatus: Record<string, number> = {};
  const byCategory: Record<string, number> = {};

  for (const item of items) {
    byStatus[item.status] = (byStatus[item.status] ?? 0) + 1;
    byCategory[item.category] = (byCategory[item.category] ?? 0) + 1;
  }

  return { byStatus, byCategory, total: items.length };
}

/** 저장소 초기화 (테스트용) */
export function clearStore(): void {
  store.clear();
  idCounter = 0;
}
