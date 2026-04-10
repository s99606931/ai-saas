// 빌링 스키마 테스트
// Design Ref: DESIGN-MTU-P08
// Plan SC: FR-P08.1~FR-P08.5
// CSAP: D-06, D-12

import { describe, it, expect } from 'vitest';
import { z } from 'zod';

const createInvoiceSchema = z.object({
  subscriptionId: z.string().min(1),
});

const processPaymentSchema = z.object({
  amount: z.number().min(0),
  method: z.enum(['card', 'bank_transfer', 'virtual_account']),
  reference: z.string().optional(),
});

describe('createInvoiceSchema (CSAP D-12)', () => {
  it('유효한 구독 ID를 허용한다', () => {
    expect(createInvoiceSchema.safeParse({ subscriptionId: 'sub-123' }).success).toBe(true);
  });

  it('빈 구독 ID를 거부한다', () => {
    expect(createInvoiceSchema.safeParse({ subscriptionId: '' }).success).toBe(false);
  });

  it('구독 ID 누락을 거부한다', () => {
    expect(createInvoiceSchema.safeParse({}).success).toBe(false);
  });
});

describe('processPaymentSchema (CSAP D-12)', () => {
  it('유효한 결제 요청을 허용한다', () => {
    const result = processPaymentSchema.safeParse({
      amount: 50000,
      method: 'card',
    });
    expect(result.success).toBe(true);
  });

  it('음수 금액을 거부한다', () => {
    expect(
      processPaymentSchema.safeParse({
        amount: -1,
        method: 'card',
      }).success,
    ).toBe(false);
  });

  it('0원 결제를 허용한다', () => {
    expect(
      processPaymentSchema.safeParse({
        amount: 0,
        method: 'card',
      }).success,
    ).toBe(true);
  });

  it('유효한 결제 방법만 허용한다', () => {
    for (const method of ['card', 'bank_transfer', 'virtual_account']) {
      expect(processPaymentSchema.safeParse({ amount: 100, method }).success).toBe(true);
    }
  });

  it('잘못된 결제 방법을 거부한다', () => {
    expect(
      processPaymentSchema.safeParse({
        amount: 100,
        method: 'bitcoin',
      }).success,
    ).toBe(false);
  });

  it('참조 번호가 선택적이다', () => {
    expect(
      processPaymentSchema.safeParse({
        amount: 100,
        method: 'card',
        reference: 'REF-001',
      }).success,
    ).toBe(true);
  });
});
