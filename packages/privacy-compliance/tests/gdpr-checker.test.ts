/**
 * GDPR/PIPA 컴플라이언스 체크 테스트
 * Plan SC: FR-GDPR.1~5
 */

import {
  ComplianceChecker,
  GDPR_CHECKLIST,
  PIPA_CHECKLIST,
  GDPR_PIPA_MAPPING,
} from '../src/gdpr-checker';

describe('체크리스트 정의', () => {
  it('GDPR 13개 핵심 조항 + PIPA 11개 조항 정의', () => {
    expect(GDPR_CHECKLIST.length).toBeGreaterThanOrEqual(13);
    expect(PIPA_CHECKLIST.length).toBeGreaterThanOrEqual(11);
  });

  it('GDPR-PIPA 매핑 테이블 정의', () => {
    expect(GDPR_PIPA_MAPPING['GDPR-15']).toBe('PIPA-35');
    expect(GDPR_PIPA_MAPPING['GDPR-17']).toBe('PIPA-36');
  });
});

describe('ComplianceChecker.check', () => {
  const checker = new ComplianceChecker();

  it('GDPR: 모두 미구현 → 0%', () => {
    const result = checker.check('GDPR', new Set());
    expect(result.passed).toBe(0);
    expect(result.coveragePercent).toBe(0);
    expect(result.failed.length).toBeGreaterThan(0);
  });

  it('GDPR: 모두 구현 → 100%', () => {
    const all = new Set(GDPR_CHECKLIST.map((c) => c.code));
    const result = checker.check('GDPR', all);
    expect(result.coveragePercent).toBe(100);
    expect(result.failed).toEqual([]);
  });

  it('PIPA: 일부 구현 시 부분 커버리지', () => {
    const result = checker.check('PIPA', new Set(['PIPA-15', 'PIPA-17']));
    expect(result.passed).toBe(2);
    expect(result.coveragePercent).toBeGreaterThan(0);
    expect(result.coveragePercent).toBeLessThan(100);
  });
});

describe('ComplianceChecker.gapAnalysis', () => {
  const checker = new ComplianceChecker();

  it('GDPR-15 + PIPA-35 → both', () => {
    const result = checker.gapAnalysis(new Set(['GDPR-15']), new Set(['PIPA-35']));
    expect(result.both).toContain('GDPR-15');
    expect(result.gdprOnly).not.toContain('GDPR-15');
  });

  it('GDPR만 구현 → gdprOnly', () => {
    const result = checker.gapAnalysis(new Set(['GDPR-15']), new Set());
    expect(result.gdprOnly).toContain('GDPR-15');
  });

  it('PIPA만 구현 → pipaOnly', () => {
    const result = checker.gapAnalysis(new Set(), new Set(['PIPA-15']));
    expect(result.pipaOnly).toContain('PIPA-15');
  });

  it('빈 입력 시 모두 빈 결과', () => {
    const result = checker.gapAnalysis(new Set(), new Set());
    expect(result.gdprOnly).toEqual([]);
    expect(result.pipaOnly).toEqual([]);
    expect(result.both).toEqual([]);
  });
});
