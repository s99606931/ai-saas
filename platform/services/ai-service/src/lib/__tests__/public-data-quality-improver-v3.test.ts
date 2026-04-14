import { describe, it, expect, beforeEach } from 'vitest';
import { PublicDataQualityImproverV3, type DataRecord } from '../public-data-quality-improver-v3';

describe('PublicDataQualityImproverV3', () => {
  let improver: PublicDataQualityImproverV3;

  beforeEach(() => {
    improver = new PublicDataQualityImproverV3();
    improver.reset();
  });

  it('throws BLOCKED for C grade record', () => {
    const records: DataRecord[] = [
      { recordId: 'R1', fields: { name: 'test' }, grade: 'C' },
    ];
    expect(() => improver.improve(records)).toThrow('BLOCKED');
  });

  it('detects MISSING_FIELD for empty value', () => {
    const records: DataRecord[] = [
      { recordId: 'R2', fields: { name: '', age: '30' }, grade: 'O' },
    ];
    const results = improver.improve(records);
    const issue = results[0]!.issues.find(i => i.errorType === 'MISSING_FIELD');
    expect(issue).toBeDefined();
    expect(issue!.field).toBe('name');
  });

  it('detects FORMAT_ERROR for dot-separated date', () => {
    const records: DataRecord[] = [
      { recordId: 'R3', fields: { regDate: '2026.04.13', name: 'Kim' }, grade: 'O' },
    ];
    const results = improver.improve(records);
    const issue = results[0]!.issues.find(i => i.errorType === 'FORMAT_ERROR');
    expect(issue).toBeDefined();
    expect(issue!.field).toBe('regDate');
  });

  it('detects DUPLICATE for same recordId', () => {
    const records: DataRecord[] = [
      { recordId: 'R4', fields: { name: 'Lee' }, grade: 'O' },
      { recordId: 'R4', fields: { name: 'Park' }, grade: 'O' },
    ];
    const results = improver.improve(records);
    const dupIssue = results[1]!.issues.find(i => i.errorType === 'DUPLICATE');
    expect(dupIssue).toBeDefined();
  });

  it('computes qualityScore as 100 for clean record', () => {
    const records: DataRecord[] = [
      { recordId: 'R5', fields: { name: 'Choi', dept: 'IT' }, grade: 'O' },
    ];
    const results = improver.improve(records);
    expect(results[0]!.qualityScore).toBe(100);
  });

  it('records audit log', () => {
    improver.improve([
      { recordId: 'R6', fields: { x: 'y' }, grade: 'O' },
    ]);
    const log = improver.getAuditLog();
    expect(log.some(e => e.action === 'quality.improve')).toBe(true);
  });
});
