import { describe, it, expect } from 'vitest';
import { PublicDataQualityCert, type DatasetMetadata } from '../public-data-quality-cert';

describe('PublicDataQualityCert', () => {
  const svc = new PublicDataQualityCert();
  const meta: DatasetMetadata = {
    datasetId: 'DS1',
    title: '민원 처리 현황',
    owner: '행정안전부',
    updateCycle: 'daily',
    lastUpdatedAt: new Date().toISOString(),
    fields: [
      { name: 'id', type: 'string', required: true },
      { name: 'count', type: 'number', required: true },
      { name: 'date', type: 'date', required: true },
    ],
    license: 'KOGL-1',
  };

  it('validates metadata', () => {
    const v = svc.validateMetadata(meta);
    expect(v.ok).toBe(true);
    const bad = svc.validateMetadata({ ...meta, license: '' });
    expect(bad.ok).toBe(false);
    expect(bad.missing).toContain('license');
  });

  it('measures quality', () => {
    const score = svc.measureQuality(meta, {
      totalRows: 2,
      rows: [
        { id: 'A1', count: 10, date: '2026-04-01' },
        { id: 'A2', count: 20, date: '2026-04-02' },
      ],
    });
    expect(score.completeness).toBe(1);
    expect(score.accuracy).toBe(1);
    expect(score.overall).toBeGreaterThan(0.9);
  });

  it('certifies grade 5 for excellent data', () => {
    const cert = svc.certify(meta, {
      totalRows: 1,
      rows: [{ id: 'A1', count: 10, date: '2026-04-01' }],
    });
    expect(cert.grade).toBeGreaterThanOrEqual(4);
  });

  it('penalizes missing required fields', () => {
    const score = svc.measureQuality(meta, {
      totalRows: 2,
      rows: [
        { id: 'A1', count: null, date: '2026-04-01' },
        { id: null, count: 20, date: '2026-04-02' },
      ],
    });
    expect(score.completeness).toBeLessThan(1);
  });

  it('detects datasets needing refresh', () => {
    const old: DatasetMetadata = {
      ...meta,
      datasetId: 'OLD',
      lastUpdatedAt: new Date(Date.now() - 30 * 86400 * 1000).toISOString(),
    };
    const refresh = svc.needsRefresh([meta, old]);
    expect(refresh).toContain('OLD');
    expect(refresh).not.toContain('DS1');
  });
});
