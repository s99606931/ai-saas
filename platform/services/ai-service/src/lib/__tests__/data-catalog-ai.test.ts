import { describe, it, expect, beforeEach } from 'vitest';
import { DataCatalogAi } from '../data-catalog-ai.js';

describe('DataCatalogAi', () => {
  let catalog: DataCatalogAi;

  beforeEach(() => {
    catalog = new DataCatalogAi();
  });

  it('PII 컬럼 자동 분류', () => {
    const t = catalog.ingest({
      database: 'gov',
      schema: 'public',
      name: 'users',
      columns: [
        { name: 'id', dataType: 'bigint', nullable: false, dataClass: 'internal', tags: [] },
        { name: 'email', dataType: 'varchar', nullable: false, dataClass: 'internal', tags: [] },
        { name: 'phone', dataType: 'varchar', nullable: true, dataClass: 'internal', tags: [] },
      ],
    });
    const email = t.columns.find((c) => c.name === 'email');
    expect(email?.dataClass).toBe('pii');
    expect(t.tags).toContain('contains-pii');
  });

  it('검색 동작', () => {
    catalog.ingest({
      database: 'gov',
      schema: 'public',
      name: 'orders',
      columns: [{ name: 'amount', dataType: 'numeric', nullable: false, dataClass: 'internal', tags: [] }],
    });
    const r = catalog.search({ keyword: 'orders' });
    expect(r).toHaveLength(1);
  });

  it('계통 연결', () => {
    catalog.ingest({
      database: 'gov',
      schema: 'raw',
      name: 'events',
      columns: [{ name: 'ts', dataType: 'timestamp', nullable: false, dataClass: 'internal', tags: [] }],
    });
    catalog.ingest({
      database: 'gov',
      schema: 'mart',
      name: 'events_daily',
      columns: [{ name: 'day', dataType: 'date', nullable: false, dataClass: 'internal', tags: [] }],
    });
    catalog.linkLineage('gov.raw.events', 'gov.mart.events_daily');
    const r = catalog.search({ keyword: 'events_daily' });
    expect(r[0]?.upstreams).toContain('gov.raw.events');
  });

  it('PII 목록 추출', () => {
    catalog.ingest({
      database: 'gov',
      schema: 'public',
      name: 'members',
      columns: [
        { name: 'name', dataType: 'varchar', nullable: false, dataClass: 'internal', tags: [] },
        { name: 'salary', dataType: 'numeric', nullable: true, dataClass: 'internal', tags: [] },
      ],
    });
    const pii = catalog.piiColumns();
    expect(pii.some((p) => p.dataClass === 'pii')).toBe(true);
    expect(pii.some((p) => p.dataClass === 'financial')).toBe(true);
  });

  it('빈 컬럼 거부', () => {
    expect(() =>
      catalog.ingest({ database: 'a', schema: 'b', name: 'c', columns: [] }),
    ).toThrow('CATALOG_EMPTY_COLUMNS');
  });
});
