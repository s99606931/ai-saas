import { describe, it, expect } from 'vitest';
import { DigitalContractLedger, type Contract } from '../digital-contract-ledger';

describe('DigitalContractLedger', () => {
  const contract: Contract = {
    contractId: 'C1',
    title: '공공 SaaS 구축',
    parties: ['기관A', '업체B'],
    amountKrw: 500_000_000,
    startDate: '2026-04-01',
    endDate: '2026-12-31',
    documentContent: '계약서 본문',
  };

  it('registers contract and verifies integrity', () => {
    const ledger = new DigitalContractLedger();
    ledger.registerContract(contract, '2026-04-01T00:00:00Z');
    const report = ledger.verifyIntegrity();
    expect(report.valid).toBe(true);
    expect(report.totalEntries).toBe(1);
  });

  it('appends amendment and keeps chain valid', () => {
    const ledger = new DigitalContractLedger();
    ledger.registerContract(contract, '2026-04-01T00:00:00Z');
    ledger.appendAmendment('C1', { amountKrw: 600_000_000 }, '2026-05-01T00:00:00Z');
    const report = ledger.verifyIntegrity();
    expect(report.valid).toBe(true);
    expect(report.totalEntries).toBe(2);
  });

  it('restores state at given index', () => {
    const ledger = new DigitalContractLedger();
    ledger.registerContract(contract, '2026-04-01T00:00:00Z');
    ledger.appendAmendment('C1', { amountKrw: 600_000_000 }, '2026-05-01T00:00:00Z');
    const atZero = ledger.restoreAt('C1', 0);
    const atOne = ledger.restoreAt('C1', 1);
    expect(atZero?.amountKrw).toBe(500_000_000);
    expect(atOne?.amountKrw).toBe(600_000_000);
  });

  it('detects tampering', () => {
    const ledger = new DigitalContractLedger();
    ledger.registerContract(contract, '2026-04-01T00:00:00Z');
    ledger.appendAmendment('C1', { amountKrw: 600_000_000 }, '2026-05-01T00:00:00Z');
    const entries = ledger.getEntries();
    (entries[1] as { payload: string }).payload = JSON.stringify({ amountKrw: 999 });
    const report = ledger.verifyIntegrity();
    expect(report.valid).toBe(false);
  });

  it('generates audit report', () => {
    const ledger = new DigitalContractLedger();
    ledger.registerContract(contract, '2026-04-01T00:00:00Z');
    const report = ledger.generateAuditReport();
    expect(report).toContain('계약 원장 감사 리포트');
    expect(report).toContain('C1');
  });
});
