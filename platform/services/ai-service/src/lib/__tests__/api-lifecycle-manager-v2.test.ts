import { describe, it, expect, beforeEach } from 'vitest';
import { PublicDataOutlierDetector, type Dataset } from '../api-lifecycle-manager-v2';

describe('PublicDataOutlierDetector', () => {
  let detector: PublicDataOutlierDetector;

  beforeEach(() => {
    detector = new PublicDataOutlierDetector();
  });

  it('detects high outlier above Q3+1.5*IQR', () => {
    const dataset: Dataset = {
      datasetId: 'DS1',
      values: [10, 12, 14, 15, 16, 17, 18, 19, 20, 100],
    };
    const result = detector.detect(dataset);
    const highOutlier = result.outliers.find(o => o.bound === 'HIGH');
    expect(highOutlier).toBeDefined();
    expect(highOutlier!.value).toBe(100);
  });

  it('detects low outlier below Q1-1.5*IQR', () => {
    const dataset: Dataset = {
      datasetId: 'DS2',
      values: [-100, 10, 12, 14, 15, 16, 17, 18, 19, 20],
    };
    const result = detector.detect(dataset);
    const lowOutlier = result.outliers.find(o => o.bound === 'LOW');
    expect(lowOutlier).toBeDefined();
    expect(lowOutlier!.value).toBe(-100);
  });

  it('returns no outliers for normal distribution', () => {
    const dataset: Dataset = {
      datasetId: 'DS3',
      values: [10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20],
    };
    const result = detector.detect(dataset);
    expect(result.outliers).toHaveLength(0);
  });

  it('computes Q1 and Q3 correctly', () => {
    const dataset: Dataset = {
      datasetId: 'DS4',
      values: [1, 2, 3, 4, 5, 6, 7, 8],
    };
    const result = detector.detect(dataset);
    // Q1 at 25th percentile of [1..8]: h=0.25*7=1.75 → 1 + 0.75*(2-1)=1.75+1=2.75
    expect(result.q1).toBeCloseTo(2.75, 1);
    // Q3 at 75th percentile: h=0.75*7=5.25 → idx5=6, idx6=7 → 6+0.25*1=6.25
    expect(result.q3).toBeCloseTo(6.25, 1);
  });

  it('assigns recommended value at bound', () => {
    const dataset: Dataset = {
      datasetId: 'DS5',
      values: [10, 12, 14, 15, 16, 17, 18, 19, 20, 100],
    };
    const result = detector.detect(dataset);
    const high = result.outliers.find(o => o.bound === 'HIGH')!;
    expect(high.recommended).toBeCloseTo(result.upperBound, 1);
  });

  it('records audit log', () => {
    detector.detect({ datasetId: 'DS6', values: [1, 2, 3, 4, 5] });
    const log = detector.getAuditLog();
    expect(log).toHaveLength(1);
    expect(log[0]!.action).toBe('outlier.detect');
  });
});
