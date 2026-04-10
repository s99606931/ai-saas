// 서비스 카탈로그 Zod 스키마 테스트
// Design Ref: DESIGN-MTU-P06
// Plan SC: FR-P06.1~FR-P06.5
// CSAP: D-12 입력 검증

import { describe, it, expect } from 'vitest';
import { z } from 'zod';

const createServiceSchema = z.object({
  name: z.string().min(1, '서비스명은 필수입니다').max(200),
  slug: z
    .string()
    .min(2)
    .max(50)
    .regex(/^[a-z0-9-]+$/),
  description: z.string().optional(),
  category: z.string().min(1),
  version: z.string().default('1.0.0'),
  isBuiltIn: z.boolean().default(false),
  config: z.record(z.unknown()).optional(),
});

const updateServiceSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().optional(),
  category: z.string().optional(),
  isActive: z.boolean().optional(),
  config: z.record(z.unknown()).optional(),
});

const versionSchema = z.object({ version: z.string().min(1) });

const toggleFlagSchema = z.object({ enabled: z.boolean() });

describe('createServiceSchema (CSAP D-12 입력 검증)', () => {
  it('유효한 서비스 등록을 허용한다', () => {
    const result = createServiceSchema.safeParse({
      name: '전자결재 서비스',
      slug: 'electronic-approval',
      category: 'workflow',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.version).toBe('1.0.0');
      expect(result.data.isBuiltIn).toBe(false);
    }
  });

  it('빈 서비스명을 거부한다', () => {
    expect(
      createServiceSchema.safeParse({
        name: '',
        slug: 'ab',
        category: 'test',
      }).success,
    ).toBe(false);
  });

  it('서비스명 200자 초과를 거부한다', () => {
    expect(
      createServiceSchema.safeParse({
        name: 'a'.repeat(201),
        slug: 'ab',
        category: 'test',
      }).success,
    ).toBe(false);
  });

  it('slug에 대문자를 거부한다', () => {
    expect(
      createServiceSchema.safeParse({
        name: 'Test',
        slug: 'InvalidSlug',
        category: 'test',
      }).success,
    ).toBe(false);
  });

  it('slug에 특수문자를 거부한다 (하이픈 제외)', () => {
    expect(
      createServiceSchema.safeParse({
        name: 'T',
        slug: 'a_b',
        category: 'test',
      }).success,
    ).toBe(false);
    expect(
      createServiceSchema.safeParse({
        name: 'T',
        slug: 'a.b',
        category: 'test',
      }).success,
    ).toBe(false);
  });

  it('slug 최소 2자를 요구한다', () => {
    expect(
      createServiceSchema.safeParse({
        name: 'T',
        slug: 'a',
        category: 'test',
      }).success,
    ).toBe(false);
  });

  it('빈 category를 거부한다', () => {
    expect(
      createServiceSchema.safeParse({
        name: 'T',
        slug: 'ab',
        category: '',
      }).success,
    ).toBe(false);
  });

  it('isBuiltIn 기본값 false가 적용된다', () => {
    const result = createServiceSchema.safeParse({
      name: 'T',
      slug: 'ab',
      category: 'test',
    });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.isBuiltIn).toBe(false);
  });

  it('config 객체를 허용한다', () => {
    const result = createServiceSchema.safeParse({
      name: 'T',
      slug: 'ab',
      category: 'test',
      config: { maxRetries: 3, timeout: 5000 },
    });
    expect(result.success).toBe(true);
  });
});

describe('updateServiceSchema (CSAP D-12)', () => {
  it('빈 업데이트를 허용한다 (모든 필드 선택적)', () => {
    expect(updateServiceSchema.safeParse({}).success).toBe(true);
  });

  it('이름만 수정을 허용한다', () => {
    expect(updateServiceSchema.safeParse({ name: '수정된 서비스' }).success).toBe(true);
  });

  it('빈 이름을 거부한다', () => {
    expect(updateServiceSchema.safeParse({ name: '' }).success).toBe(false);
  });

  it('활성화 토글을 허용한다', () => {
    expect(updateServiceSchema.safeParse({ isActive: false }).success).toBe(true);
  });
});

describe('versionSchema (CSAP D-12)', () => {
  it('유효한 버전 문자열을 허용한다', () => {
    expect(versionSchema.safeParse({ version: '2.0.0' }).success).toBe(true);
  });

  it('빈 버전을 거부한다', () => {
    expect(versionSchema.safeParse({ version: '' }).success).toBe(false);
  });

  it('버전 누락을 거부한다', () => {
    expect(versionSchema.safeParse({}).success).toBe(false);
  });
});

describe('toggleFlagSchema (FR-P06.3 Feature Flag)', () => {
  it('true 토글을 허용한다', () => {
    expect(toggleFlagSchema.safeParse({ enabled: true }).success).toBe(true);
  });

  it('false 토글을 허용한다', () => {
    expect(toggleFlagSchema.safeParse({ enabled: false }).success).toBe(true);
  });

  it('문자열 "true"를 거부한다', () => {
    expect(toggleFlagSchema.safeParse({ enabled: 'true' }).success).toBe(false);
  });

  it('enabled 누락을 거부한다', () => {
    expect(toggleFlagSchema.safeParse({}).success).toBe(false);
  });
});
