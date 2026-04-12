import { describe, it, expect } from 'vitest';
import { EtaxInvoiceAi, type EtaxInvoice } from '../etax-invoice-ai';

describe('EtaxInvoiceAi', () => {
  const svc = new EtaxInvoiceAi();

  const validInvoice: EtaxInvoice = {
    approvalNumber: '202604110001',
    issueDate: '2026-04-11',
    supplierBizNo: '1234567890',
    supplierName: '공급자',
    buyerBizNo: '0987654321',
    buyerName: '구매자',
    itemName: 'AI 컨설팅',
    supplyAmountKrw: 1_000_000,
    vatKrw: 100_000,
    totalKrw: 1_100_000,
  };

  it('parses raw xml map', () => {
    const inv = svc.parseInvoice({
      approvalNumber: 'A1',
      issueDate: '2026-04-11',
      supplierBizNo: '1234567890',
      buyerBizNo: '0987654321',
      itemName: '품목',
      supplyAmountKrw: '1000000',
      vatKrw: '100000',
      totalKrw: '1100000',
    });
    expect(inv).not.toBeNull();
    expect(inv?.supplyAmountKrw).toBe(1_000_000);
  });

  it('returns null on missing required field', () => {
    expect(svc.parseInvoice({ approvalNumber: 'A1' })).toBeNull();
  });

  it('validates fields', () => {
    const v = svc.validateFields(validInvoice);
    expect(v.valid).toBe(true);
  });

  it('detects duplicates', () => {
    const dups = svc.detectDuplicates([validInvoice, { ...validInvoice }]);
    expect(dups.length).toBe(1);
    expect(dups[0]?.count).toBe(2);
  });

  it('verifies VAT calculation', () => {
    const check = svc.verifyVat(validInvoice);
    expect(check.valid).toBe(true);
    const bad = svc.verifyVat({ ...validInvoice, vatKrw: 50_000 });
    expect(bad.valid).toBe(false);
  });

  it('lists all anomalies', () => {
    const bad: EtaxInvoice = { ...validInvoice, supplierBizNo: 'bad', vatKrw: 0 };
    const list = svc.listAnomalies([validInvoice, bad]);
    expect(list.invalidFields.length).toBeGreaterThanOrEqual(1);
    expect(list.vatMismatches.length).toBeGreaterThanOrEqual(1);
  });
});
