import { describe, it, expect, beforeEach } from 'vitest';
import { PublicDataCatalogAIV3 } from '../public-data-catalog-ai-v3';

describe('PublicDataCatalogAIV3', () => {
  let cat: PublicDataCatalogAIV3;

  beforeEach(() => {
    cat = new PublicDataCatalogAIV3();
  });

  const fresh = {
    datasetId: 'd1',
    title: 'complete dataset',
    fields: [
      { name: 'id', filled: true, standardMatched: true },
      { name: 'name', filled: true, standardMatched: true },
      { name: 'value', filled: true, standardMatched: true },
      { name: 'date', filled: true, standardMatched: true },
    ],
    ageDays: 10,
  };

  it('grades A for fresh, complete, standard dataset', () => {
    const r = cat.analyze(fresh);
    expect(r.grade).toBe('A');
    expect(r.score).toBe(100);
  });

  it('grades D for old, empty, non-standard dataset', () => {
    const r = cat.analyze({
      ...fresh,
      fields: fresh.fields.map((f) => ({ ...f, filled: false, standardMatched: false })),
      ageDays: 500,
    });
    expect(r.grade).toBe('D');
  });

  it('grades B when partial completeness', () => {
    const r = cat.analyze({
      ...fresh,
      fields: [
        { name: 'id', filled: true, standardMatched: true },
        { name: 'name', filled: true, standardMatched: true },
        { name: 'val', filled: true, standardMatched: false },
        { name: 'date', filled: false, standardMatched: false },
      ],
    });
    expect(['B', 'C']).toContain(r.grade);
  });

  it('blocks C/S grade (N2SF N-05)', () => {
    expect(() => cat.analyze(fresh, 'C')).toThrow('BLOCKED');
    expect(() => cat.analyze(fresh, 'S')).toThrow('BLOCKED');
  });

  it('rejects empty fields', () => {
    expect(() => cat.analyze({ ...fresh, fields: [] })).toThrow('EMPTY_FIELDS');
  });

  it('records audit log', () => {
    cat.analyze(fresh);
    expect(cat.getAuditLog().some((e) => e.action === 'ANALYZE_DATASET')).toBe(true);
  });
});
