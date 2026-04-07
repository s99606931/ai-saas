// 테넌트 Zod 스키마 테스트
// Design Ref: DESIGN-MTU-P03
// Plan SC: FR-P03.1~FR-P03.6
// CSAP: N2SF N-03 격리, D-12 입력 검증

import { describe, it, expect } from 'vitest';
import { z } from 'zod';

const createTenantSchema = z.object({
  name: z.string().min(1, '테넌트명은 필수입니다').max(200),
  slug: z.string().min(2).max(50).regex(/^[a-z0-9-]+$/, 'slug는 소문자, 숫자, 하이픈만 허용'),
  maxUsers: z.number().int().min(1).max(10000).default(10),
  maxStorage: z.number().int().min(0).default(1073741824),
});

const updateTenantSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  maxUsers: z.number().int().min(1).max(10000).optional(),
  maxStorage: z.number().int().min(0).optional(),
  config: z.record(z.unknown()).optional(),
  theme: z.object({
    primaryColor: z.string().optional(),
    logoUrl: z.string().url().optional(),
    faviconUrl: z.string().url().optional(),
    sidebarVariant: z.enum(['default', 'compact', 'floating']).optional(),
  }).optional(),
});

const updateStatusSchema = z.object({
  status: z.enum(['ACTIVE', 'SUSPENDED', 'ARCHIVED']),
  reason: z.string().optional(),
});

describe('createTenantSchema (CSAP D-12, N2SF N-03)', () => {
  it('유효한 테넌트 생성 요청을 허용한다', () => {
    const result = createTenantSchema.safeParse({
      name: '서울시 교육청',
      slug: 'seoul-education',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.maxUsers).toBe(10); // 기본값
      expect(result.data.maxStorage).toBe(1073741824); // 1GB 기본값
    }
  });

  it('slug에 대문자를 거부한다', () => {
    const result = createTenantSchema.safeParse({
      name: 'Test',
      slug: 'InvalidSlug',
    });
    expect(result.success).toBe(false);
  });

  it('slug에 특수문자를 거부한다 (하이픈 제외)', () => {
    expect(createTenantSchema.safeParse({ name: 'T', slug: 'a_b' }).success).toBe(false);
    expect(createTenantSchema.safeParse({ name: 'T', slug: 'a.b' }).success).toBe(false);
    expect(createTenantSchema.safeParse({ name: 'T', slug: 'a b' }).success).toBe(false);
  });

  it('slug에 하이픈을 허용한다', () => {
    const result = createTenantSchema.safeParse({
      name: '테스트',
      slug: 'my-tenant-slug',
    });
    expect(result.success).toBe(true);
  });

  it('빈 테넌트명을 거부한다', () => {
    const result = createTenantSchema.safeParse({
      name: '',
      slug: 'valid-slug',
    });
    expect(result.success).toBe(false);
  });

  it('maxUsers를 10000으로 제한한다', () => {
    expect(createTenantSchema.safeParse({
      name: 'T', slug: 'ab', maxUsers: 10001,
    }).success).toBe(false);
  });

  it('slug 최소 2자를 요구한다', () => {
    expect(createTenantSchema.safeParse({
      name: 'T', slug: 'a',
    }).success).toBe(false);
  });
});

describe('updateTenantSchema', () => {
  it('빈 업데이트를 허용한다 (모든 필드 선택적)', () => {
    const result = updateTenantSchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it('테마 설정을 허용한다', () => {
    const result = updateTenantSchema.safeParse({
      theme: {
        primaryColor: '#1234ab',
        sidebarVariant: 'compact',
      },
    });
    expect(result.success).toBe(true);
  });

  it('잘못된 사이드바 변형을 거부한다', () => {
    const result = updateTenantSchema.safeParse({
      theme: { sidebarVariant: 'wide' },
    });
    expect(result.success).toBe(false);
  });

  it('잘못된 URL 형식의 로고를 거부한다', () => {
    const result = updateTenantSchema.safeParse({
      theme: { logoUrl: 'not-a-url' },
    });
    expect(result.success).toBe(false);
  });
});

describe('updateStatusSchema (N2SF N-03 격리)', () => {
  it('유효한 상태 변경을 허용한다', () => {
    for (const status of ['ACTIVE', 'SUSPENDED', 'ARCHIVED']) {
      expect(updateStatusSchema.safeParse({ status }).success).toBe(true);
    }
  });

  it('잘못된 상태를 거부한다', () => {
    expect(updateStatusSchema.safeParse({ status: 'DELETED' }).success).toBe(false);
    expect(updateStatusSchema.safeParse({ status: 'active' }).success).toBe(false);
  });

  it('이유가 선택적이다', () => {
    const result = updateStatusSchema.safeParse({
      status: 'SUSPENDED',
      reason: '미납',
    });
    expect(result.success).toBe(true);
  });
});
