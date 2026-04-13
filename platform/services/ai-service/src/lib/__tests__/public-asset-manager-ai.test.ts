import { describe, it, expect } from 'vitest';
import { PublicAssetManagerAI } from '../public-asset-manager-ai.js';

describe('SVC-AI-ADV-R427 PublicAssetManagerAI', () => {
  const svc = new PublicAssetManagerAI();

  it('FR-427.2: 신규 자산 → KEEP', () => {
    const out = svc.evaluate([
      { assetId: 'A1', elapsedYears: 2, usefulLifeYears: 10, condition: 'GOOD' },
    ]);
    expect(out[0]!.recommendation).toBe('KEEP');
    expect(out[0]!.reasonCode).toBe('AGE_OK');
  });

  it('FR-427.2: 임박 → REVIEW', () => {
    const out = svc.evaluate([
      { assetId: 'A2', elapsedYears: 8, usefulLifeYears: 10, condition: 'GOOD' },
    ]);
    expect(out[0]!.recommendation).toBe('REVIEW');
  });

  it('FR-427.2: 내용연수 초과 → DISPOSE', () => {
    const out = svc.evaluate([
      { assetId: 'A3', elapsedYears: 12, usefulLifeYears: 10, condition: 'GOOD' },
    ]);
    expect(out[0]!.recommendation).toBe('DISPOSE');
    expect(out[0]!.reasonCode).toBe('END_OF_LIFE');
  });

  it('FR-427.3: BAD 조건 → 강제 DISPOSE', () => {
    const out = svc.evaluate([
      { assetId: 'A4', elapsedYears: 1, usefulLifeYears: 10, condition: 'BAD' },
    ]);
    expect(out[0]!.recommendation).toBe('DISPOSE');
    expect(out[0]!.reasonCode).toBe('BAD_CONDITION');
  });

  it('FR-427.4: S 차단', () => {
    expect(() => svc.evaluate([], 'S')).toThrow('N2SF_BLOCKED');
  });

  it('감사 로그', () => {
    svc.evaluate([{ assetId: 'A5', elapsedYears: 5, usefulLifeYears: 10, condition: 'FAIR' }]);
    expect(svc.getAuditLog().length).toBeGreaterThan(0);
  });
});
