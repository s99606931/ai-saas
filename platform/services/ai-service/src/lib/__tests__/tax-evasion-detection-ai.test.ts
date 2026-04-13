import { describe, it, expect, beforeEach } from 'vitest';
import { TaxEvasionDetectionAI, type TaxpayerRecord } from '../tax-evasion-detection-ai';

describe('TaxEvasionDetectionAI', () => {
  let ai: TaxEvasionDetectionAI;

  const baseRecord = (): TaxpayerRecord => ({
    taxpayerId: 'T1',
    businessType: 'retail',
    declaredRevenue: 500_000_000,
    declaredIncome: 50_000_000,
    cardSales: 300_000_000,
    cashDeposits: 200_000_000,
    employeeCount: 5,
    overseasTransfers: 0,
  });

  beforeEach(() => {
    ai = new TaxEvasionDetectionAI();
  });

  it('정상 신고 시 low 위험', () => {
    const r = ai.assess(baseRecord());
    expect(r.riskLevel).toBe('low');
  });

  it('카드매출이 신고매출 초과 시 고위험', () => {
    const rec = baseRecord();
    rec.cardSales = 800_000_000;
    const r = ai.assess(rec);
    expect(r.score).toBeGreaterThanOrEqual(40);
    expect(r.indicators.some((i) => i.includes('카드매출 초과'))).toBe(true);
  });

  it('현금입금 과다 시 중~고위험', () => {
    const rec = baseRecord();
    rec.cashDeposits = 800_000_000;
    const r = ai.assess(rec);
    expect(r.score).toBeGreaterThanOrEqual(25);
  });

  it('해외송금 과다 시 위험 증가', () => {
    const rec = baseRecord();
    rec.overseasTransfers = 200_000_000;
    const r = ai.assess(rec);
    expect(r.indicators.some((i) => i.includes('해외송금'))).toBe(true);
  });

  it('critical 수준 시 추천감사 true', () => {
    const rec = baseRecord();
    rec.cardSales = 900_000_000;
    rec.cashDeposits = 700_000_000;
    rec.overseasTransfers = 200_000_000;
    rec.declaredIncome = 5_000_000;
    const r = ai.assess(rec);
    expect(r.recommendedAudit).toBe(true);
  });

  it('음수 매출 입력 시 오류', () => {
    const rec = baseRecord();
    rec.declaredRevenue = -1;
    expect(() => ai.assess(rec)).toThrow();
  });
});
