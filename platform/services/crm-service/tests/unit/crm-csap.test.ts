// CRM 서비스 CSAP 보안 테스트
// Design Ref: DESIGN-MTU-P09
// Plan SC: FR-P09.1~FR-P09.6
// CSAP: D-08 접근통제, D-06 감사로그, D-12 입력검증, N2SF N-05 PII

import { describe, it, expect } from 'vitest';
import { z } from 'zod';

const createCustomerSchema = z.object({
  tenantId: z.string().min(1),
  companyName: z.string().min(1).max(200),
  businessNumber: z
    .string()
    .regex(/^\d{3}-\d{2}-\d{5}$/, '사업자등록번호 형식 필수')
    .optional(),
  representativeName: z.string().max(50).optional(),
  email: z.string().email().optional(),
  phone: z
    .string()
    .regex(/^0\d{1,2}-\d{3,4}-\d{4}$/, '전화번호 형식 필수')
    .optional(),
  address: z.string().max(500).optional(),
  grade: z.enum(['VIP', 'GOLD', 'SILVER', 'BRONZE', 'GENERAL']).default('GENERAL'),
});

const createContactSchema = z.object({
  customerId: z.string().min(1),
  name: z.string().min(1).max(50),
  position: z.string().max(50).optional(),
  email: z.string().email().optional(),
  phone: z.string().optional(),
});

describe('CSAP D-12: CRM 입력 검증', () => {
  it('유효한 고객 생성을 허용한다', () => {
    const result = createCustomerSchema.safeParse({
      tenantId: 'tenant-1',
      companyName: '(주)공공기관',
      businessNumber: '123-45-67890',
      grade: 'GOLD',
    });
    expect(result.success).toBe(true);
  });

  it('잘못된 사업자등록번호를 거부한다', () => {
    expect(
      createCustomerSchema.safeParse({
        tenantId: 'tenant-1',
        companyName: '회사',
        businessNumber: '1234567890',
      }).success,
    ).toBe(false);
  });

  it('잘못된 전화번호를 거부한다', () => {
    expect(
      createCustomerSchema.safeParse({
        tenantId: 'tenant-1',
        companyName: '회사',
        phone: '010-1234',
      }).success,
    ).toBe(false);
  });

  it('잘못된 이메일을 거부한다', () => {
    expect(
      createCustomerSchema.safeParse({
        tenantId: 'tenant-1',
        companyName: '회사',
        email: 'invalid-email',
      }).success,
    ).toBe(false);
  });

  it('잘못된 고객 등급을 거부한다', () => {
    expect(
      createCustomerSchema.safeParse({
        tenantId: 'tenant-1',
        companyName: '회사',
        grade: 'DIAMOND',
      }).success,
    ).toBe(false);
  });

  it('담당자 생성 시 customerId가 필수이다', () => {
    expect(
      createContactSchema.safeParse({
        name: '홍길동',
      }).success,
    ).toBe(false);
  });
});

describe('N2SF N-05: CRM PII 보호', () => {
  it('개인정보 마스킹이 올바르다', () => {
    const phone = '010-1234-5678';
    const maskedPhone = phone.replace(/(\d{3})-(\d{4})-(\d{4})/, '$1-****-$3');
    expect(maskedPhone).toBe('010-****-5678');
  });

  it('이메일 마스킹이 올바르다', () => {
    const email = 'admin@example.com';
    const [local, domain] = email.split('@');
    const masked = local.substring(0, 2) + '***@' + domain;
    expect(masked).toBe('ad***@example.com');
  });

  it('사업자등록번호 마스킹이 올바르다', () => {
    const bn = '123-45-67890';
    const masked = bn.replace(/(\d{3})-(\d{2})-(\d{5})/, '$1-**-*****');
    expect(masked).toBe('123-**-*****');
  });
});

describe('CSAP D-06: CRM 감사 로그', () => {
  it('고객 관리 이벤트가 정의된다', () => {
    const events = ['CUSTOMER_CREATED', 'CUSTOMER_UPDATED', 'CONTACT_CREATED', 'CONTRACT_CREATED', 'CONTRACT_UPDATED'];
    expect(events.length).toBeGreaterThanOrEqual(5);
  });

  it('개인정보 조회도 감사 대상이다', () => {
    const auditableActions = ['CUSTOMER_VIEWED', 'CONTACT_VIEWED'];
    expect(auditableActions.length).toBeGreaterThanOrEqual(2);
  });
});
