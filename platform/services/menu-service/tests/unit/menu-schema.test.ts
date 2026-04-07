// 메뉴 Zod 스키마 테스트
// Design Ref: DESIGN-MTU-P05
// Plan SC: FR-P05.1~FR-P05.5
// CSAP: D-08-05 역할 기반 접근 통제, D-12 입력 검증

import { describe, it, expect } from 'vitest';
import { z } from 'zod';

const createMenuSchema = z.object({
  tenantId: z.string().min(1),
  parentId: z.string().nullable().optional(),
  label: z.string().min(1, '메뉴명은 필수입니다').max(100),
  path: z.string().min(1),
  icon: z.string().optional(),
  order: z.number().int().min(0).default(0),
  isVisible: z.boolean().default(true),
  roles: z.array(z.string()).optional(),
});

const updateMenuSchema = z.object({
  label: z.string().min(1).max(100).optional(),
  path: z.string().optional(),
  icon: z.string().nullable().optional(),
  order: z.number().int().min(0).optional(),
  isVisible: z.boolean().optional(),
  roles: z.array(z.string()).optional(),
});

const reorderSchema = z.object({
  order: z.number().int().min(0),
  parentId: z.string().nullable().optional(),
});

describe('createMenuSchema (CSAP D-12 입력 검증)', () => {
  it('유효한 메뉴 생성을 허용한다', () => {
    const result = createMenuSchema.safeParse({
      tenantId: 'tenant-1',
      label: '대시보드',
      path: '/dashboard',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.order).toBe(0);
      expect(result.data.isVisible).toBe(true);
    }
  });

  it('빈 tenantId를 거부한다', () => {
    expect(createMenuSchema.safeParse({
      tenantId: '', label: '메뉴', path: '/path',
    }).success).toBe(false);
  });

  it('빈 메뉴명을 거부한다', () => {
    expect(createMenuSchema.safeParse({
      tenantId: 't1', label: '', path: '/path',
    }).success).toBe(false);
  });

  it('메뉴명 100자 초과를 거부한다', () => {
    expect(createMenuSchema.safeParse({
      tenantId: 't1', label: 'a'.repeat(101), path: '/path',
    }).success).toBe(false);
  });

  it('빈 경로를 거부한다', () => {
    expect(createMenuSchema.safeParse({
      tenantId: 't1', label: '메뉴', path: '',
    }).success).toBe(false);
  });

  it('parentId를 null로 허용한다 (최상위 메뉴)', () => {
    const result = createMenuSchema.safeParse({
      tenantId: 't1', label: '메뉴', path: '/path', parentId: null,
    });
    expect(result.success).toBe(true);
  });

  it('음수 order를 거부한다', () => {
    expect(createMenuSchema.safeParse({
      tenantId: 't1', label: '메뉴', path: '/path', order: -1,
    }).success).toBe(false);
  });

  it('roles 배열을 허용한다 (CSAP D-08-05 역할 기반 접근 통제)', () => {
    const result = createMenuSchema.safeParse({
      tenantId: 't1', label: '관리자 메뉴', path: '/admin',
      roles: ['SUPER_ADMIN', 'ADMIN'],
    });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.roles).toEqual(['SUPER_ADMIN', 'ADMIN']);
  });

  it('roles 없이도 허용한다 (전체 공개)', () => {
    const result = createMenuSchema.safeParse({
      tenantId: 't1', label: '메뉴', path: '/path',
    });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.roles).toBeUndefined();
  });
});

describe('updateMenuSchema (CSAP D-12)', () => {
  it('빈 업데이트를 허용한다', () => {
    expect(updateMenuSchema.safeParse({}).success).toBe(true);
  });

  it('라벨만 수정을 허용한다', () => {
    expect(updateMenuSchema.safeParse({ label: '수정된 메뉴' }).success).toBe(true);
  });

  it('빈 라벨을 거부한다', () => {
    expect(updateMenuSchema.safeParse({ label: '' }).success).toBe(false);
  });

  it('icon을 null로 설정 (아이콘 제거)을 허용한다', () => {
    expect(updateMenuSchema.safeParse({ icon: null }).success).toBe(true);
  });

  it('isVisible 토글을 허용한다', () => {
    expect(updateMenuSchema.safeParse({ isVisible: false }).success).toBe(true);
  });

  it('roles 빈 배열을 허용한다 (전체 공개로 변경)', () => {
    expect(updateMenuSchema.safeParse({ roles: [] }).success).toBe(true);
  });
});

describe('reorderSchema (FR-P05.3 드래그앤드롭)', () => {
  it('유효한 순서 변경을 허용한다', () => {
    expect(reorderSchema.safeParse({ order: 5 }).success).toBe(true);
  });

  it('음수 순서를 거부한다', () => {
    expect(reorderSchema.safeParse({ order: -1 }).success).toBe(false);
  });

  it('order 누락을 거부한다', () => {
    expect(reorderSchema.safeParse({}).success).toBe(false);
  });

  it('parentId 이동 (하위 메뉴로 이동)을 허용한다', () => {
    expect(reorderSchema.safeParse({
      order: 0, parentId: 'menu-parent-1',
    }).success).toBe(true);
  });

  it('parentId null (최상위로 이동)을 허용한다', () => {
    expect(reorderSchema.safeParse({
      order: 0, parentId: null,
    }).success).toBe(true);
  });
});
