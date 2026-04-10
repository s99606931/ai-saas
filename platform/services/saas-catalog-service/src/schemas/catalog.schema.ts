// SaaS 카탈로그 Zod 스키마 (CSAP D-12 입력 검증)
// Design Ref: SVC-SAASCAT-R3 DESIGN -- 데이터 모델
// Plan SC: FR-SCAT.1, FR-SCAT.6

import { z } from 'zod';

/** 카탈로그 카테고리 */
export const CatalogCategory = z.enum([
  'BUSINESS',
  'DOCUMENT',
  'SECURITY',
  'AI_ML',
  'INFRA',
  'DATA',
  'COLLABORATION',
  'OTHER',
]);
export type CatalogCategory = z.infer<typeof CatalogCategory>;

/** 카탈로그 상태 */
export const CatalogStatus = z.enum([
  'DRAFT',
  'PENDING',
  'APPROVED',
  'REJECTED',
  'DEPRECATED',
]);
export type CatalogStatus = z.infer<typeof CatalogStatus>;

/** CSAP 등급 */
export const CsapGrade = z.enum(['STANDARD', 'HIGH', 'NONE']);
export type CsapGrade = z.infer<typeof CsapGrade>;

/** 카탈로그 항목 생성 스키마 */
export const createCatalogSchema = z.object({
  name: z.string().min(1, '이름은 필수입니다').max(200, '이름은 200자 이하'),
  description: z.string().min(1, '설명은 필수입니다').max(2000, '설명은 2000자 이하'),
  category: CatalogCategory,
  provider: z.string().min(1, '제공자는 필수입니다').max(200),
  version: z.string().min(1, '버전은 필수입니다').max(50),
  csapGrade: CsapGrade.default('NONE'),
  tags: z.array(z.string().max(50)).max(20).default([]),
  pricing: z.string().max(500).nullable().default(null),
  documentationUrl: z.string().url('유효한 URL을 입력하세요').nullable().default(null),
});
export type CreateCatalogInput = z.infer<typeof createCatalogSchema>;

/** 카탈로그 항목 수정 스키마 */
export const updateCatalogSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().min(1).max(2000).optional(),
  category: CatalogCategory.optional(),
  provider: z.string().min(1).max(200).optional(),
  version: z.string().min(1).max(50).optional(),
  csapGrade: CsapGrade.optional(),
  tags: z.array(z.string().max(50)).max(20).optional(),
  pricing: z.string().max(500).nullable().optional(),
  documentationUrl: z.string().url().nullable().optional(),
});
export type UpdateCatalogInput = z.infer<typeof updateCatalogSchema>;

/** 거절 사유 스키마 */
export const rejectSchema = z.object({
  reason: z.string().min(1, '거절 사유는 필수입니다').max(1000),
});

/** 목록 조회 쿼리 스키마 */
export const listQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  category: CatalogCategory.optional(),
  status: CatalogStatus.optional(),
  search: z.string().max(200).optional(),
  sort: z.enum(['name', 'createdAt', 'updatedAt']).default('createdAt'),
  order: z.enum(['asc', 'desc']).default('desc'),
});
export type ListQueryInput = z.infer<typeof listQuerySchema>;

/** 카탈로그 항목 인터페이스 */
export interface SaasCatalogItem {
  id: string;
  tenantId: string;
  name: string;
  description: string;
  category: CatalogCategory;
  provider: string;
  version: string;
  status: CatalogStatus;
  csapGrade: CsapGrade;
  tags: string[];
  pricing: string | null;
  documentationUrl: string | null;
  rejectionReason: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
  createdBy: string;
  updatedBy: string;
}

/** 카테고리 목록 (한국어 표시명 포함) */
export const CATEGORY_LIST = [
  { code: 'BUSINESS' as const, name: '업무관리' },
  { code: 'DOCUMENT' as const, name: '문서관리' },
  { code: 'SECURITY' as const, name: '보안' },
  { code: 'AI_ML' as const, name: 'AI/ML' },
  { code: 'INFRA' as const, name: '인프라' },
  { code: 'DATA' as const, name: '데이터' },
  { code: 'COLLABORATION' as const, name: '협업' },
  { code: 'OTHER' as const, name: '기타' },
] as const;
