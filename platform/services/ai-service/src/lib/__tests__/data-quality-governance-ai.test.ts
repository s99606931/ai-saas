import { describe, it, expect, beforeEach } from 'vitest';
import { DataQualityGovernanceAi, type DatasetStats } from '../data-quality-governance-ai';

describe('DataQualityGovernanceAi', () => {
  let ai: DataQualityGovernanceAi;

  beforeEach(() => {
    ai = new DataQualityGovernanceAi();
  });

  const sample = (over: Partial<DatasetStats> = {}): DatasetStats => ({
    datasetId: 'ds-1',
    totalRows: 1000,
    missingValues: 0,
    invalidValues: 0,
    duplicateRows: 0,
    staleDays: 0,
    schemaViolations: 0,
    ...over,
  });

  it('완벽 데이터셋은 A등급이다', () => {
    const result = ai.evaluate(sample());
    expect(result.grade).toBe('A');
    expect(result.overall).toBeGreaterThanOrEqual(95);
  });

  it('결측 50% 데이터셋은 issue 보고된다', () => {
    const result = ai.evaluate(sample({ missingValues: 500 }));
    expect(result.issues).toContain('high_missing_values');
  });

  it('30일 경과 데이터는 timeliness 70이다', () => {
    const result = ai.evaluate(sample({ staleDays: 30 }));
    expect(result.dimensions.timeliness).toBe(70);
  });

  it('중복 100건 시 uniqueness가 떨어진다', () => {
    const result = ai.evaluate(sample({ duplicateRows: 100 }));
    expect(result.dimensions.uniqueness).toBeLessThan(95);
    expect(result.issues).toContain('duplicate_records');
  });

  it('이슈 기반으로 액션을 추천한다', () => {
    const score = ai.evaluate(sample({ missingValues: 500, duplicateRows: 100 }));
    const actions = ai.recommendActions(score);
    expect(actions).toContain('imputation_pipeline');
    expect(actions).toContain('deduplication_job');
  });

  it('S등급 데이터는 차단된다', () => {
    expect(() => ai.evaluate(sample(), 'S')).toThrow('BLOCKED');
  });
});
