import { describe, it, expect } from 'vitest';
import { DataQualityMonitor, type Expectation } from '../data-quality-monitor.js';

describe('DataQualityMonitor', () => {
  const monitor = new DataQualityMonitor();

  const rows = [
    { id: 1, email: 'a@x.kr', age: 30, status: 'active' },
    { id: 2, email: 'b@x.kr', age: 45, status: 'active' },
    { id: 3, email: null, age: 200, status: 'unknown' },
  ];

  const expectations: Expectation[] = [
    { id: 'e1', column: 'email', type: 'not_null', params: {}, severity: 'error' },
    { id: 'e2', column: 'age', type: 'range', params: { min: 0, max: 120 }, severity: 'error' },
    { id: 'e3', column: 'status', type: 'categorical', params: { values: ['active', 'inactive'] }, severity: 'warn' },
    { id: 'e4', column: 'id', type: 'unique', params: {}, severity: 'error' },
  ];

  it('품질 점수 계산', () => {
    const r = monitor.run('users', rows, expectations);
    expect(r.rowCount).toBe(3);
    expect(r.qualityScore).toBeLessThan(1);
  });

  it('not_null 실패 탐지', () => {
    const r = monitor.run('users', rows, [expectations[0]!]);
    expect(r.expectationResults[0]?.failureCount).toBe(1);
  });

  it('range 실패 탐지', () => {
    const r = monitor.run('users', rows, [expectations[1]!]);
    expect(r.expectationResults[0]?.failureCount).toBe(1);
  });

  it('drift 감지', () => {
    monitor.run('ds1', [{ value: 10 }, { value: 12 }], []);
    const r = monitor.run('ds1', [{ value: 50 }, { value: 60 }], []);
    expect(r.driftDetected).toBe(true);
  });

  it('빈 데이터셋 거부', () => {
    expect(() => monitor.run('ds', [], [])).toThrow('DQ_EMPTY_DATASET');
  });
});
