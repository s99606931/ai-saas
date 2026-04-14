import { describe, it, expect, beforeEach } from 'vitest';
import { ContractComplianceCheckerV3 } from '../contract-compliance-checker-v3';

describe('SVC-AI-ADV-R643 ContractComplianceCheckerV3', () => {
  let svc: ContractComplianceCheckerV3;

  beforeEach(() => {
    svc = new ContractComplianceCheckerV3();
  });

  it('FR-R643.1: 계약 등록', () => {
    svc.registerContract('c1', 'VendorA');
    expect(svc.getComplianceRate('c1')).toBe(0);
  });

  it('FR-R643.2: C등급 차단', () => {
    svc.registerContract('c1', 'VendorA');
    expect(() => svc.checkCondition('c1', true, 'C')).toThrow(/BLOCKED/);
  });

  it('FR-R643.3: 준수율 산출', () => {
    svc.registerContract('c1', 'VendorA');
    svc.checkCondition('c1', true);
    svc.checkCondition('c1', true);
    svc.checkCondition('c1', false);
    expect(svc.getComplianceRate('c1')).toBeCloseTo(2 / 3, 5);
  });

  it('FR-R643.4: 미준수 계약 반환', () => {
    svc.registerContract('c1', 'VendorA');
    svc.registerContract('c2', 'VendorB');
    svc.checkCondition('c1', true);
    svc.checkCondition('c2', false);
    const non = svc.getNonCompliantContracts();
    expect(non.map((c) => c.contractId)).toEqual(['c2']);
  });

  it('FR-R643.5: 감사 로그 기록', () => {
    svc.registerContract('c1', 'VendorA');
    svc.checkCondition('c1', true);
    const log = svc.getAuditLog();
    expect(log.some((e) => e.action === 'CHECK_CONDITION')).toBe(true);
  });
});
