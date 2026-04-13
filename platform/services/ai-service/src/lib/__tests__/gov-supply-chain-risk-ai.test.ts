/**
 * 정부 공급망 리스크 AI 단위 테스트 — SVC-AI-ADV-R472
 * Plan SC: FR-472.1~6
 */

import { describe, it, expect } from 'vitest';
import { GovSupplyChainRiskAi } from '../gov-supply-chain-risk-ai';
import type { Supplier } from '../gov-supply-chain-risk-ai';

const mk = (id: string, overrides: Partial<Supplier> = {}): Supplier => ({
  id,
  country: 'KR',
  tier: 1,
  financialHealth: 80,
  singleSource: false,
  certifications: ['ISO9001'],
  ...overrides,
});

describe('GovSupplyChainRiskAi — R472', () => {
  it('FR-472.1: 정상 공급사 LOW 등급', () => {
    const ai = new GovSupplyChainRiskAi();
    const r = ai.assess(mk('S1'));
    expect(r.riskLevel).toBe('LOW');
  });

  it('FR-472.2: 금수 국가 CRITICAL 판정', () => {
    const ai = new GovSupplyChainRiskAi();
    const r = ai.assess(mk('S2', { country: 'XX1', singleSource: true }));
    expect(r.riskLevel).toBe('CRITICAL');
    expect(r.factors).toContain('embargo_country');
  });

  it('FR-472.3: 단일 공급원 + 재무 불량 가중치', () => {
    const ai = new GovSupplyChainRiskAi();
    const r = ai.assess(
      mk('S3', { singleSource: true, financialHealth: 20, certifications: [] }),
    );
    expect(r.riskScore).toBeGreaterThanOrEqual(50);
    expect(r.factors).toContain('single_source');
    expect(r.factors).toContain('poor_financial_health');
  });

  it('FR-472.4: 배치 평가 + CRITICAL 집계', () => {
    const ai = new GovSupplyChainRiskAi();
    const list = [
      mk('A'),
      mk('B', { country: 'XX2', singleSource: true, certifications: [] }),
      mk('C', { tier: 3, financialHealth: 30 }),
    ];
    const reports = ai.assessBatch(list);
    expect(reports).toHaveLength(3);
    expect(reports.some((r) => r.riskLevel === 'CRITICAL')).toBe(true);
  });

  it('FR-472.5: 감사 로그 동작', () => {
    const ai = new GovSupplyChainRiskAi();
    ai.assess(mk('X'));
    const log = ai.getAuditLog();
    expect(log.length).toBeGreaterThan(0);
    expect(log[0]!.action).toBe('SUPPLY_CHAIN_ASSESS');
  });

  it('FR-472.6: C/S 등급 차단', () => {
    const ai = new GovSupplyChainRiskAi();
    expect(() => ai.assess(mk('Z'), 'S')).toThrow(/N2SF_BLOCKED/);
  });
});
