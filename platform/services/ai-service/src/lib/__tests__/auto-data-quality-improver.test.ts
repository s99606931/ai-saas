import { describe, it, expect, beforeEach } from 'vitest';
import { AutoDataQualityImprover } from '../auto-data-quality-improver';

describe('AutoDataQualityImprover', () => {
  let improver: AutoDataQualityImprover;

  beforeEach(() => {
    improver = new AutoDataQualityImprover();
  });

  it('품질 규칙을 등록한다', () => {
    improver.registerRule('r1', 'name', 'not_null');
    expect(improver.getAuditLog().some(l => l.action === 'REGISTER_RULE')).toBe(true);
  });

  it('not_null 규칙 위반을 탐지한다', () => {
    improver.registerRule('r1', 'name', 'not_null');
    const result = improver.inspectRecord('rec1', { name: '' });
    expect(result.issues.some(i => i.issueType === 'not_null')).toBe(true);
    expect(result.qualityScore).toBeLessThan(100);
  });

  it('range 규칙 위반을 탐지한다', () => {
    improver.registerRule('r1', 'age', 'range', { min: 0, max: 120 });
    const result = improver.inspectRecord('rec1', { age: 200 });
    expect(result.issues.some(i => i.issueType === 'range')).toBe(true);
  });

  it('enum 규칙 위반을 탐지한다', () => {
    improver.registerRule('r1', 'status', 'enum', { values: ['active', 'inactive'] });
    const result = improver.inspectRecord('rec1', { status: 'unknown' });
    expect(result.issues.some(i => i.issueType === 'enum')).toBe(true);
  });

  it('유효한 데이터는 qualityScore=100이다', () => {
    improver.registerRule('r1', 'name', 'not_null');
    const result = improver.inspectRecord('rec1', { name: 'Alice' });
    expect(result.qualityScore).toBe(100);
    expect(result.issues.length).toBe(0);
  });

  it('not_null 수정 제안을 반환한다', () => {
    improver.registerRule('r1', 'name', 'not_null');
    improver.inspectRecord('rec1', { name: null });
    const fix = improver.suggestFix('rec1', 'name');
    expect(fix).not.toBeNull();
    expect(fix!.issueType).toBe('not_null');
  });

  it('C등급 데이터 검사를 차단한다', () => {
    improver.registerRule('r1', 'name', 'not_null');
    expect(() => improver.inspectRecord('rec1', { name: 'test' }, 'C' as never)).toThrow('BLOCKED');
  });

  it('다중 레코드 품질 점수를 계산한다', () => {
    improver.registerRule('r1', 'name', 'not_null');
    const score = improver.getQualityScore([{ name: 'Alice' }, { name: '' }]);
    expect(score).toBe(50);
  });
});
