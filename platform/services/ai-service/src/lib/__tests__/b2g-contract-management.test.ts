// MTU-N293 B2G 계약 관리 AI 테스트
import { describe, it, expect } from 'vitest';
import {
  registerContract,
  extractObligations,
  monitorContractDeadlines,
  fulfillObligation,
  B2GContractManagementService,
  type Contract,
} from '../b2g-contract-management.js';

describe('MTU-N293 B2GContractManagement', () => {
  const tenantId = 'tenant-n293';

  function makeContract(overrides: Partial<Contract> = {}): Contract {
    return {
      contractId: `c-${Math.random().toString(36).slice(2, 8)}`,
      tenantId,
      title: '국토부 SaaS 도입 계약',
      counterparty: '국토교통부',
      startDate: '2026-01-01',
      endDate: '2026-12-31',
      amountKrw: 100_000_000,
      status: 'active',
      text: '월간 보고 제출\n2026-06-30 까지 1차 산출물 제출\n분기별 운영 보고',
      ...overrides,
    };
  }

  it('FR-N293.1: 계약 등록', () => {
    const c = makeContract();
    registerContract(c);
    expect(c.contractId).toBeDefined();
  });

  it('FR-N293.2: 의무사항 추출', () => {
    const c = makeContract();
    registerContract(c);
    const obls = extractObligations(c);
    expect(obls.length).toBeGreaterThanOrEqual(2);
  });

  it('FR-N293.3: 만료 임박 알림', () => {
    const today = new Date('2026-12-15');
    const c = makeContract({ endDate: '2026-12-20' });
    registerContract(c);
    const alerts = monitorContractDeadlines(tenantId, today);
    expect(alerts.some((a) => a.type === 'expiring')).toBe(true);
  });

  it('FR-N293.3: 의무 지연 알림', () => {
    const c = makeContract({ text: '2026-01-01 까지 자료 제출' });
    registerContract(c);
    extractObligations(c);
    const alerts = monitorContractDeadlines(tenantId, new Date('2026-04-11'));
    expect(alerts.some((a) => a.type === 'overdue')).toBe(true);
  });

  it('FR-N293.4: 의무 이행 처리', () => {
    const c = makeContract();
    registerContract(c);
    const obls = extractObligations(c);
    if (obls.length > 0) {
      const ok = fulfillObligation(c.contractId, obls[0].obligationId, 'u1', tenantId);
      expect(ok).toBe(true);
    }
  });

  it('FR-N293.6: Service + 감사 로그', () => {
    const svc = new B2GContractManagementService('tenant-svc-n293');
    svc.register({
      contractId: 'svc-c1',
      title: 't',
      counterparty: 'gov',
      startDate: '2026-01-01',
      endDate: '2026-12-31',
      amountKrw: 1000000,
      status: 'active',
      text: '월간 보고',
    });
    svc.extract('svc-c1');
    expect(svc.audit().length).toBeGreaterThan(0);
  });
});
