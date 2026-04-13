/**
 * 부처간 자금 이체 AI 단위 테스트 — SVC-AI-ADV-R470
 * Plan SC: FR-470.1~6
 */

import { describe, it, expect } from 'vitest';
import { IntergovernmentalFundTransferAi } from '../intergovernmental-fund-transfer-ai';
import type { Account } from '../intergovernmental-fund-transfer-ai';

const mkAcct = (agency: string, balance: number, limit: number, used = 0): Account => ({
  agency,
  balance,
  dailyLimit: limit,
  usedToday: used,
});

describe('IntergovernmentalFundTransferAi — R470', () => {
  it('FR-470.3/5: 정상 이체 시 잔액 갱신', () => {
    const t = new IntergovernmentalFundTransferAi();
    const from = mkAcct('MOF', 10_000_000, 20_000_000);
    const to = mkAcct('MOE', 5_000_000, 20_000_000);
    const r = t.process(
      { from: 'MOF', to: 'MOE', amount: 1_000_000, approvalCode: 'APR-123456' },
      from,
      to,
    );
    expect(r.success).toBe(true);
    expect(r.newFromBalance).toBe(9_000_000);
    expect(r.newToBalance).toBe(6_000_000);
  });

  it('FR-470.4: 잔액 부족 차단', () => {
    const t = new IntergovernmentalFundTransferAi();
    const from = mkAcct('A', 100, 1_000_000);
    const to = mkAcct('B', 0, 1_000_000);
    const r = t.process(
      { from: 'A', to: 'B', amount: 1000, approvalCode: 'APR-000001' },
      from,
      to,
    );
    expect(r.success).toBe(false);
    expect(r.reason).toMatch(/balance/);
  });

  it('FR-470.4: 승인 코드 형식 오류 차단', () => {
    const t = new IntergovernmentalFundTransferAi();
    const from = mkAcct('A', 10000, 1_000_000);
    const to = mkAcct('B', 0, 1_000_000);
    const r = t.process(
      { from: 'A', to: 'B', amount: 100, approvalCode: 'INVALID' },
      from,
      to,
    );
    expect(r.success).toBe(false);
    expect(r.reason).toMatch(/approval/);
  });

  it('FR-470.4: 일일 한도 초과 차단', () => {
    const t = new IntergovernmentalFundTransferAi();
    const from = mkAcct('A', 10_000_000, 1_000_000, 900_000);
    const to = mkAcct('B', 0, 1_000_000);
    const r = t.process(
      { from: 'A', to: 'B', amount: 200_000, approvalCode: 'APR-999999' },
      from,
      to,
    );
    expect(r.success).toBe(false);
    expect(r.reason).toMatch(/limit/);
  });

  it('FR-470.4: 음수/0 amount 차단', () => {
    const t = new IntergovernmentalFundTransferAi();
    const from = mkAcct('A', 100, 100);
    const to = mkAcct('B', 0, 100);
    const r = t.process(
      { from: 'A', to: 'B', amount: 0, approvalCode: 'APR-000001' },
      from,
      to,
    );
    expect(r.success).toBe(false);
  });

  it('FR-470.6: C/S 차단 + audit log', () => {
    const t = new IntergovernmentalFundTransferAi();
    const from = mkAcct('A', 100, 100);
    const to = mkAcct('B', 0, 100);
    expect(() =>
      t.process({ from: 'A', to: 'B', amount: 10, approvalCode: 'APR-000001' }, from, to, 'C'),
    ).toThrow(/N2SF_BLOCKED/);
    t.process({ from: 'A', to: 'B', amount: 10, approvalCode: 'APR-000001' }, from, to);
    expect(t.getAuditLog().length).toBeGreaterThan(0);
  });
});
