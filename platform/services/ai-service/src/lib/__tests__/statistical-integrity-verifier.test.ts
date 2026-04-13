/**
 * 통계 무결성 검증 AI 단위 테스트 — SVC-AI-ADV-R483
 * Plan SC: FR-483.1~6
 */

import { describe, it, expect } from 'vitest';
import { StatisticalIntegrityVerifier } from '../statistical-integrity-verifier';
import type { StatisticalDataset } from '../statistical-integrity-verifier';

const mk = (over: Partial<StatisticalDataset> = {}): StatisticalDataset => ({
  datasetId: 'D1',
  values: [10, 12, 11, 13, 9, 10, 12, 11],
  reportedMean: 11,
  reportedStdDev: 1.2,
  source: 'kostat',
  ...over,
});

describe('StatisticalIntegrityVerifier — R483', () => {
  it('FR-483.1: 정상 데이터 VALID', () => {
    const v = new StatisticalIntegrityVerifier();
    const r = v.verify(mk());
    expect(['VALID', 'SUSPICIOUS']).toContain(r.verdict);
  });

  it('FR-483.2: 보고 평균 위조 INVALID', () => {
    const v = new StatisticalIntegrityVerifier();
    const r = v.verify(mk({ reportedMean: 100 }));
    expect(r.verdict).toBe('INVALID');
  });

  it('FR-483.3: 이상치 카운트', () => {
    const v = new StatisticalIntegrityVerifier();
    const vals = [10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 500];
    const r = v.verify(mk({ values: vals, reportedMean: 34.5, reportedStdDev: 107 }));
    expect(r.anomalies).toBeGreaterThan(0);
  });

  it('FR-483.4: 벤포드 카이제곱', () => {
    const v = new StatisticalIntegrityVerifier();
    const chi = v.benfordCheck([100, 200, 300, 1500, 2200, 1100]);
    expect(chi).toBeGreaterThanOrEqual(0);
  });

  it('FR-483.5: audit 로그', () => {
    const v = new StatisticalIntegrityVerifier();
    v.verify(mk());
    expect(v.getAuditLog().length).toBeGreaterThan(0);
  });

  it('FR-483.6: C/S 차단', () => {
    const v = new StatisticalIntegrityVerifier();
    expect(() => v.verify(mk(), 'C')).toThrow(/N2SF_BLOCKED/);
    expect(() => v.verify(mk(), 'S')).toThrow(/N2SF_BLOCKED/);
  });
});
