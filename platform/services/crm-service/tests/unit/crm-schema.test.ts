// CRM Zod 스키마 테스트
// Design Ref: DESIGN-MTU-P09
// Plan SC: FR-P09.1~FR-P09.5
// CSAP: D-08, D-06, D-12

import { describe, it, expect } from 'vitest';
import { z } from 'zod';

const createCustomerSchema = z.object({
  name: z.string().min(1, '고객사명은 필수입니다').max(200),
  industry: z.string().optional(),
  size: z.string().optional(),
  tenantId: z.string().nullable().optional(),
});

const createContactSchema = z.object({
  name: z.string().min(1).max(100),
  email: z.string().email(),
  phone: z.string().optional(),
  role: z.string().optional(),
  isPrimary: z.boolean().default(false),
});

const createContractSchema = z.object({
  customerId: z.string().min(1),
  title: z.string().min(1).max(200),
  value: z.number().min(0),
  startDate: z.string().datetime(),
  endDate: z.string().datetime(),
});

const updateCustomerSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  industry: z.string().optional(),
  size: z.string().optional(),
  status: z.string().optional(),
});

const updateContractSchema = z.object({
  title: z.string().optional(),
  value: z.number().min(0).optional(),
  status: z.string().optional(),
});

describe('createCustomerSchema (CSAP D-12 입력 검증)', () => {
  it('유효한 고객사 등록을 허용한다', () => {
    const result = createCustomerSchema.safeParse({
      name: '서울시 교육청',
      industry: '공공기관',
      size: 'large',
    });
    expect(result.success).toBe(true);
  });

  it('빈 고객사명을 거부한다', () => {
    expect(createCustomerSchema.safeParse({ name: '' }).success).toBe(false);
  });

  it('고객사명 200자 초과를 거부한다', () => {
    expect(createCustomerSchema.safeParse({ name: 'a'.repeat(201) }).success).toBe(false);
  });

  it('tenantId nullable을 허용한다', () => {
    expect(createCustomerSchema.safeParse({ name: 'T', tenantId: null }).success).toBe(true);
  });

  it('tenantId 없이도 허용한다', () => {
    expect(createCustomerSchema.safeParse({ name: 'T' }).success).toBe(true);
  });
});

describe('createContactSchema (CSAP D-12)', () => {
  it('유효한 담당자를 허용한다', () => {
    const result = createContactSchema.safeParse({
      name: '홍길동',
      email: 'hong@example.go.kr',
    });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.isPrimary).toBe(false);
  });

  it('잘못된 이메일 형식을 거부한다', () => {
    expect(createContactSchema.safeParse({
      name: '홍길동', email: 'invalid-email',
    }).success).toBe(false);
  });

  it('빈 이름을 거부한다', () => {
    expect(createContactSchema.safeParse({
      name: '', email: 'a@b.com',
    }).success).toBe(false);
  });

  it('이름 100자 초과를 거부한다', () => {
    expect(createContactSchema.safeParse({
      name: 'a'.repeat(101), email: 'a@b.com',
    }).success).toBe(false);
  });

  it('isPrimary 기본값 false가 적용된다', () => {
    const result = createContactSchema.safeParse({
      name: 'T', email: 'a@b.com',
    });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.isPrimary).toBe(false);
  });

  it('전화번호를 선택적으로 허용한다', () => {
    expect(createContactSchema.safeParse({
      name: 'T', email: 'a@b.com', phone: '010-1234-5678',
    }).success).toBe(true);
  });
});

describe('createContractSchema (CSAP D-12)', () => {
  it('유효한 계약을 허용한다', () => {
    const result = createContractSchema.safeParse({
      customerId: 'cust-1',
      title: 'SaaS 연간 계약',
      value: 50000000,
      startDate: '2026-01-01T00:00:00.000Z',
      endDate: '2026-12-31T23:59:59.000Z',
    });
    expect(result.success).toBe(true);
  });

  it('음수 계약 금액을 거부한다', () => {
    expect(createContractSchema.safeParse({
      customerId: 'c1', title: 'T', value: -1,
      startDate: '2026-01-01T00:00:00.000Z',
      endDate: '2026-12-31T23:59:59.000Z',
    }).success).toBe(false);
  });

  it('0원 계약을 허용한다 (무상 계약)', () => {
    expect(createContractSchema.safeParse({
      customerId: 'c1', title: 'T', value: 0,
      startDate: '2026-01-01T00:00:00.000Z',
      endDate: '2026-12-31T23:59:59.000Z',
    }).success).toBe(true);
  });

  it('잘못된 날짜 형식을 거부한다', () => {
    expect(createContractSchema.safeParse({
      customerId: 'c1', title: 'T', value: 0,
      startDate: '2026-01-01',  // datetime이 아님
      endDate: '2026-12-31',
    }).success).toBe(false);
  });

  it('빈 customerId를 거부한다', () => {
    expect(createContractSchema.safeParse({
      customerId: '', title: 'T', value: 0,
      startDate: '2026-01-01T00:00:00.000Z',
      endDate: '2026-12-31T23:59:59.000Z',
    }).success).toBe(false);
  });

  it('빈 제목을 거부한다', () => {
    expect(createContractSchema.safeParse({
      customerId: 'c1', title: '', value: 0,
      startDate: '2026-01-01T00:00:00.000Z',
      endDate: '2026-12-31T23:59:59.000Z',
    }).success).toBe(false);
  });
});

describe('updateCustomerSchema (CSAP D-12)', () => {
  it('빈 업데이트를 허용한다', () => {
    expect(updateCustomerSchema.safeParse({}).success).toBe(true);
  });

  it('이름만 수정을 허용한다', () => {
    expect(updateCustomerSchema.safeParse({ name: '수정된 고객사' }).success).toBe(true);
  });

  it('빈 이름을 거부한다', () => {
    expect(updateCustomerSchema.safeParse({ name: '' }).success).toBe(false);
  });
});

describe('updateContractSchema (CSAP D-12)', () => {
  it('빈 업데이트를 허용한다', () => {
    expect(updateContractSchema.safeParse({}).success).toBe(true);
  });

  it('음수 금액을 거부한다', () => {
    expect(updateContractSchema.safeParse({ value: -100 }).success).toBe(false);
  });

  it('상태 변경을 허용한다', () => {
    expect(updateContractSchema.safeParse({ status: 'closed_won' }).success).toBe(true);
  });
});
