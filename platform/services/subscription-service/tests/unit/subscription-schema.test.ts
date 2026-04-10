// 구독 서비스 스키마 테스트
// Design Ref: DESIGN-MTU-P07
// Plan SC: FR-P07.1~FR-P07.6
// CSAP: D-06, D-12

import { describe, it, expect } from 'vitest';
import { z } from 'zod';

const createPlanSchema = z.object({
  name: z.string().min(1, '플랜명은 필수입니다').max(100),
  slug: z
    .string()
    .min(2)
    .max(50)
    .regex(/^[a-z0-9-]+$/),
  price: z.number().min(0),
  currency: z.string().default('KRW'),
  interval: z.enum(['monthly', 'yearly']).default('monthly'),
  maxUsers: z.number().int().min(1),
  maxStorage: z.number().int().min(0),
});

const subscribeSchema = z.object({
  tenantId: z.string().min(1),
  planId: z.string().min(1),
});

describe('createPlanSchema (CSAP D-12)', () => {
  it('유효한 플랜을 허용한다', () => {
    const result = createPlanSchema.safeParse({
      name: '기본 플랜',
      slug: 'basic-plan',
      price: 50000,
      maxUsers: 10,
      maxStorage: 1073741824,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.currency).toBe('KRW');
      expect(result.data.interval).toBe('monthly');
    }
  });

  it('빈 플랜명을 거부한다', () => {
    expect(
      createPlanSchema.safeParse({
        name: '',
        slug: 'ab',
        price: 0,
        maxUsers: 1,
        maxStorage: 0,
      }).success,
    ).toBe(false);
  });

  it('음수 가격을 거부한다', () => {
    expect(
      createPlanSchema.safeParse({
        name: 'T',
        slug: 'ab',
        price: -1,
        maxUsers: 1,
        maxStorage: 0,
      }).success,
    ).toBe(false);
  });

  it('무료 플랜(0원)을 허용한다', () => {
    expect(
      createPlanSchema.safeParse({
        name: '무료',
        slug: 'free',
        price: 0,
        maxUsers: 1,
        maxStorage: 0,
      }).success,
    ).toBe(true);
  });

  it('monthly/yearly 간격만 허용한다', () => {
    expect(
      createPlanSchema.safeParse({
        name: 'T',
        slug: 'ab',
        price: 0,
        maxUsers: 1,
        maxStorage: 0,
        interval: 'weekly',
      }).success,
    ).toBe(false);
  });

  it('maxUsers 최소 1을 요구한다', () => {
    expect(
      createPlanSchema.safeParse({
        name: 'T',
        slug: 'ab',
        price: 0,
        maxUsers: 0,
        maxStorage: 0,
      }).success,
    ).toBe(false);
  });
});

describe('subscribeSchema (CSAP D-12)', () => {
  it('유효한 구독 요청을 허용한다', () => {
    expect(
      subscribeSchema.safeParse({
        tenantId: 'tenant-1',
        planId: 'plan-1',
      }).success,
    ).toBe(true);
  });

  it('빈 tenantId를 거부한다', () => {
    expect(
      subscribeSchema.safeParse({
        tenantId: '',
        planId: 'plan-1',
      }).success,
    ).toBe(false);
  });

  it('빈 planId를 거부한다', () => {
    expect(
      subscribeSchema.safeParse({
        tenantId: 'tenant-1',
        planId: '',
      }).success,
    ).toBe(false);
  });
});
