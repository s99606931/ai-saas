import { describe, it, expect } from 'vitest';
import { MedicalDataAnonymizerV2 } from '../medical-data-anonymizer-v2.js';

describe('SVC-AI-ADV-R352 MedicalDataAnonymizerV2', () => {
  const svc = new MedicalDataAnonymizerV2();

  it('FR-352.1: k-익명성 위반 감지', () => {
    const records = [
      { age: 30, zip: '100', disease: 'flu' },
      { age: 40, zip: '100', disease: 'cold' },
    ];
    const r = svc.analyze(records, 2, 1, ['age', 'zip'], 'disease');
    expect(r.kViolations.length).toBe(2);
    expect(r.compliant).toBe(false);
  });

  it('FR-352.2: l-다양성 위반 감지', () => {
    const records = [
      { age: 30, zip: '100', disease: 'flu' },
      { age: 30, zip: '100', disease: 'flu' },
      { age: 30, zip: '100', disease: 'flu' },
    ];
    const r = svc.analyze(records, 1, 2, ['age', 'zip'], 'disease');
    expect(r.lViolations.length).toBe(1);
  });

  it('준수 케이스', () => {
    const records = [
      { age: 30, zip: '100', disease: 'flu' },
      { age: 30, zip: '100', disease: 'cold' },
      { age: 30, zip: '100', disease: 'allergy' },
    ];
    const r = svc.analyze(records, 2, 2, ['age', 'zip'], 'disease');
    expect(r.compliant).toBe(true);
  });

  it('FR-352.3: C/S 차단', () => {
    expect(() => svc.analyze([], 1, 1, ['a'], 'b', 'S')).toThrow('N2SF_BLOCKED');
  });

  it('FR-352.4: 감사 로그', () => {
    svc.analyze([{ a: 1, s: 'x' }], 1, 1, ['a'], 's');
    expect(svc.getAuditLog().length).toBeGreaterThan(0);
  });

  it('INVALID_PARAMS', () => {
    expect(() => svc.analyze([], 0, 1, [], 's')).toThrow('INVALID_PARAMS');
  });
});
