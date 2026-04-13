/**
 * 공공자산 수익화 AI 단위 테스트 — SVC-AI-ADV-R485
 * Plan SC: FR-485.1~6
 */

import { describe, it, expect } from 'vitest';
import { PublicAssetMonetizationAi } from '../public-asset-monetization-ai';
import type { PublicAsset } from '../public-asset-monetization-ai';

const mk = (over: Partial<PublicAsset> = {}): PublicAsset => ({
  assetId: 'A1',
  type: 'BUILDING',
  bookValueKrw: 1_000_000_000,
  currentUtilization: 0.2,
  maintenanceCostKrwPerYear: 10_000_000,
  locationScore: 80,
  ...over,
});

describe('PublicAssetMonetizationAi — R485', () => {
  it('FR-485.1: 저활용 + 좋은 위치 → LEASE', () => {
    const ai = new PublicAssetMonetizationAi();
    const r = ai.propose(mk());
    expect(r.strategy).toBe('LEASE');
  });

  it('FR-485.2: 데이터 자산 → DIGITIZE', () => {
    const ai = new PublicAssetMonetizationAi();
    const r = ai.propose(mk({ type: 'DATA' }));
    expect(r.strategy).toBe('DIGITIZE');
  });

  it('FR-485.3: 고활용 → HOLD', () => {
    const ai = new PublicAssetMonetizationAi();
    const r = ai.propose(mk({ currentUtilization: 0.95 }));
    expect(r.strategy).toBe('HOLD');
  });

  it('FR-485.4: 포트폴리오 수익률', () => {
    const ai = new PublicAssetMonetizationAi();
    const y = ai.portfolioYield([mk(), mk({ assetId: 'A2', type: 'IP' })]);
    expect(y).toBeGreaterThanOrEqual(0);
  });

  it('FR-485.5: audit 로그', () => {
    const ai = new PublicAssetMonetizationAi();
    ai.propose(mk());
    expect(ai.getAuditLog().length).toBeGreaterThan(0);
  });

  it('FR-485.6: C/S 차단', () => {
    const ai = new PublicAssetMonetizationAi();
    expect(() => ai.propose(mk(), 'C')).toThrow(/N2SF_BLOCKED/);
    expect(() => ai.propose(mk(), 'S')).toThrow(/N2SF_BLOCKED/);
  });
});
