// MTU-N311 데이터 품질 검증 테스트
import { describe, it, expect } from 'vitest';
import { DataQualityValidatorService } from '../data-quality-validator.js';

describe('MTU-N311 DataQualityValidator', () => {
  const svc = new DataQualityValidatorService('tenant-n311');

  const schema = {
    fields: [
      { name: 'id', type: 'number' as const, required: true },
      { name: 'name', type: 'string' as const, required: true },
      { name: 'age', type: 'number' as const, required: false },
    ],
  };
  const records = [
    { id: 1, name: 'Alice', age: 30 },
    { id: 2, name: 'Bob', age: 25 },
    { id: 3, name: 'Charlie' },
  ];

  it('FR-N311.1: 스키마 검증', () => {
    const violations = svc.validate(records, schema);
    expect(Array.isArray(violations)).toBe(true);
  });

  it('FR-N311.2: 품질 점수 계산', () => {
    const score = svc.score(records, schema);
    expect(score.overall).toBeGreaterThanOrEqual(0);
  });

  it('FR-N311.3: 품질 리포트 생성', () => {
    const report = svc.report(records, schema);
    expect(report).toBeDefined();
  });

  it('FR-N311.6: 감사 로그', () => {
    expect(svc.getAuditLog().length).toBeGreaterThan(0);
  });
});
