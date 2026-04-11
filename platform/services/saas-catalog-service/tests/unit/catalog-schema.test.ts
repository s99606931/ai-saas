// SaaS 카탈로그 스키마 검증 단위 테스트
// Design Ref: SVC-SAASCAT-R3 DESIGN
// Plan SC: FR-SCAT.1, FR-SCAT.6
// CSAP: D-12 입력 검증

import { describe, it, expect } from 'vitest';
import {
  createCatalogSchema,
  updateCatalogSchema,
  rejectSchema,
  listQuerySchema,
  CatalogCategory,
  CatalogStatus,
  CsapGrade,
  CATEGORY_LIST,
} from '../../src/schemas/catalog.schema.js';

// -- createCatalogSchema ──────────────────────────────────────────────────

describe('createCatalogSchema (CSAP D-12)', () => {
  const validInput = {
    name: 'AI 보안 감사 도구',
    description: '공공기관 보안 감사 자동화 서비스',
    category: 'AI_ML' as const,
    provider: '한국AI연구소',
    version: '1.0.0',
  };

  it('유효한 최소 입력을 허용한다', () => {
    const result = createCatalogSchema.safeParse(validInput);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.csapGrade).toBe('NONE'); // 기본값
      expect(result.data.tags).toEqual([]);
    }
  });

  it('모든 필드를 포함한 입력을 허용한다', () => {
    expect(createCatalogSchema.safeParse({
      ...validInput,
      csapGrade: 'HIGH',
      tags: ['보안', 'AI', 'CSAP'],
      pricing: '월 100만원',
      documentationUrl: 'https://docs.example.com',
    }).success).toBe(true);
  });

  it('이름 누락을 거부한다', () => {
    const { name, ...rest } = validInput;
    expect(createCatalogSchema.safeParse(rest).success).toBe(false);
  });

  it('빈 이름을 거부한다', () => {
    expect(createCatalogSchema.safeParse({ ...validInput, name: '' }).success).toBe(false);
  });

  it('이름 200자 초과를 거부한다', () => {
    expect(createCatalogSchema.safeParse({ ...validInput, name: 'a'.repeat(201) }).success).toBe(false);
  });

  it('설명 2000자 초과를 거부한다', () => {
    expect(createCatalogSchema.safeParse({ ...validInput, description: 'a'.repeat(2001) }).success).toBe(false);
  });

  it('잘못된 카테고리를 거부한다', () => {
    expect(createCatalogSchema.safeParse({ ...validInput, category: 'INVALID' }).success).toBe(false);
  });

  it('잘못된 CSAP 등급을 거부한다', () => {
    expect(createCatalogSchema.safeParse({ ...validInput, csapGrade: 'LOW' }).success).toBe(false);
  });

  it('태그 20개 초과를 거부한다', () => {
    const tags = Array.from({ length: 21 }, (_, i) => `tag${i}`);
    expect(createCatalogSchema.safeParse({ ...validInput, tags }).success).toBe(false);
  });

  it('태그 단일 항목 50자 초과를 거부한다', () => {
    expect(createCatalogSchema.safeParse({ ...validInput, tags: ['a'.repeat(51)] }).success).toBe(false);
  });

  it('잘못된 URL을 거부한다', () => {
    expect(createCatalogSchema.safeParse({ ...validInput, documentationUrl: 'not-a-url' }).success).toBe(false);
  });

  it('null URL을 허용한다', () => {
    expect(createCatalogSchema.safeParse({ ...validInput, documentationUrl: null }).success).toBe(true);
  });
});

// -- updateCatalogSchema ──────────────────────────────────────────────────

describe('updateCatalogSchema', () => {
  it('빈 수정 요청을 허용한다 (부분 수정)', () => {
    expect(updateCatalogSchema.safeParse({}).success).toBe(true);
  });

  it('이름만 수정을 허용한다', () => {
    expect(updateCatalogSchema.safeParse({ name: '새 이름' }).success).toBe(true);
  });

  it('빈 이름을 거부한다', () => {
    expect(updateCatalogSchema.safeParse({ name: '' }).success).toBe(false);
  });
});

// -- rejectSchema ─────────────────────────────────────────────────────────

describe('rejectSchema', () => {
  it('유효한 거절 사유를 허용한다', () => {
    expect(rejectSchema.safeParse({ reason: 'CSAP 인증 미충족' }).success).toBe(true);
  });

  it('빈 거절 사유를 거부한다', () => {
    expect(rejectSchema.safeParse({ reason: '' }).success).toBe(false);
  });

  it('1000자 초과를 거부한다', () => {
    expect(rejectSchema.safeParse({ reason: 'a'.repeat(1001) }).success).toBe(false);
  });
});

// -- listQuerySchema ──────────────────────────────────────────────────────

describe('listQuerySchema', () => {
  it('빈 쿼리를 허용한다 (기본값 적용)', () => {
    const result = listQuerySchema.safeParse({});
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.page).toBe(1);
      expect(result.data.limit).toBe(20);
      expect(result.data.sort).toBe('createdAt');
      expect(result.data.order).toBe('desc');
    }
  });

  it('카테고리 필터를 허용한다', () => {
    expect(listQuerySchema.safeParse({ category: 'AI_ML' }).success).toBe(true);
  });

  it('상태 필터를 허용한다', () => {
    expect(listQuerySchema.safeParse({ status: 'APPROVED' }).success).toBe(true);
  });

  it('정렬 필드를 허용한다', () => {
    expect(listQuerySchema.safeParse({ sort: 'name', order: 'asc' }).success).toBe(true);
  });

  it('잘못된 정렬 필드를 거부한다', () => {
    expect(listQuerySchema.safeParse({ sort: 'invalid' }).success).toBe(false);
  });

  it('검색어 200자 초과를 거부한다', () => {
    expect(listQuerySchema.safeParse({ search: 'a'.repeat(201) }).success).toBe(false);
  });
});

// -- 열거형 정의 ──────────────────────────────────────────────────────────

describe('카탈로그 열거형', () => {
  it('8개 카테고리가 정의되어 있다', () => {
    expect(CATEGORY_LIST).toHaveLength(8);
  });

  it('CSAP 등급은 3개이다', () => {
    const result = CsapGrade.safeParse('STANDARD');
    expect(result.success).toBe(true);
    expect(CsapGrade.safeParse('HIGH').success).toBe(true);
    expect(CsapGrade.safeParse('NONE').success).toBe(true);
    expect(CsapGrade.safeParse('LOW').success).toBe(false);
  });

  it('상태 값이 올바르다', () => {
    const validStatuses = ['DRAFT', 'PENDING', 'APPROVED', 'REJECTED', 'DEPRECATED'];
    for (const s of validStatuses) {
      expect(CatalogStatus.safeParse(s).success).toBe(true);
    }
    expect(CatalogStatus.safeParse('ACTIVE').success).toBe(false);
  });
});
