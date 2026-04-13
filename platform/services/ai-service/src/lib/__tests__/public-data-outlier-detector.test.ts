import { describe, it, expect } from 'vitest';
import { PublicDataOutlierDetector } from '../public-data-outlier-detector.js';

describe('SVC-AI-ADV-R452 PublicDataOutlierDetector', () => {
  const svc = new PublicDataOutlierDetector();

  it('FR-452.3: 상한 초과 탐지', () => {
    const r = svc.detect({
      datasetId: 'ds1',
      values: [10, 12, 11, 13, 12, 11, 100],
    });
    expect(r.outliers.length).toBeGreaterThan(0);
    expect(r.outliers[0]!.bound).toBe('HIGH');
  });

  it('FR-452.3: 하한 미만 탐지', () => {
    const r = svc.detect({
      datasetId: 'ds1',
      values: [50, 48, 52, 49, 51, 50, -200],
    });
    expect(r.outliers[0]!.bound).toBe('LOW');
    expect(r.outliers[0]!.recommended).toBe(r.q1);
  });

  it('FR-452.4: 빈 배열', () => {
    const r = svc.detect({ datasetId: 'ds1', values: [] });
    expect(r.outliers.length).toBe(0);
  });

  it('FR-452.5: 상한 초과 시 Q3 권고', () => {
    const r = svc.detect({
      datasetId: 'ds1',
      values: [10, 12, 11, 13, 12, 11, 100],
    });
    expect(r.outliers[0]!.recommended).toBe(r.q3);
  });

  it('이상치 없음', () => {
    const r = svc.detect({ datasetId: 'ds1', values: [10, 11, 12, 13, 14] });
    expect(r.outliers.length).toBe(0);
  });

  it('datasetId 없음 → 오류', () => {
    expect(() => svc.detect({ datasetId: '', values: [1, 2, 3] })).toThrow(
      'INVALID_DATASET_ID',
    );
  });

  it('FR-452.6: C 차단', () => {
    expect(() => svc.detect({ datasetId: 'ds1', values: [] }, 'C')).toThrow(
      'N2SF_BLOCKED',
    );
  });

  it('감사 로그', () => {
    svc.detect({ datasetId: 'ds1', values: [] });
    expect(svc.getAuditLog().length).toBeGreaterThan(0);
  });
});
