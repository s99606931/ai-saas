import { describe, it, expect } from 'vitest';
import { HeteroDbSyncEngine, type TableSchema, type SyncRow } from '../hetero-db-sync.js';

describe('HeteroDbSyncEngine', () => {
  const engine = new HeteroDbSyncEngine();
  engine.addTypeMapping({ fromDialect: 'oracle', fromType: 'NUMBER', toDialect: 'postgres', toType: 'numeric' });

  const source: TableSchema = {
    dialect: 'oracle',
    table: 'emp',
    columns: [
      { name: 'id', type: 'NUMBER', nullable: false, primaryKey: true },
      { name: 'salary', type: 'NUMBER', nullable: true, primaryKey: false },
    ],
  };

  it('타입 매핑', () => {
    expect(engine.translateType(source, 'postgres', 'salary')).toBe('numeric');
  });

  it('insert/update/delete 델타', () => {
    const src: SyncRow[] = [
      { pkValue: 1, fields: { salary: 100 }, updatedAt: '2026-04-12' },
      { pkValue: 2, fields: { salary: 200 }, updatedAt: '2026-04-12' },
    ];
    const tgt: SyncRow[] = [
      { pkValue: 2, fields: { salary: 150 }, updatedAt: '2026-04-11' },
      { pkValue: 3, fields: { salary: 300 }, updatedAt: '2026-04-10' },
    ];
    const delta = engine.computeDelta(src, tgt, 'source-wins');
    expect(delta.inserts.map((r) => r.pkValue)).toEqual([1]);
    expect(delta.updates.map((r) => r.pkValue)).toEqual([2]);
    expect(delta.deletes).toEqual([3]);
  });

  it('manual 충돌 수집', () => {
    const src: SyncRow[] = [{ pkValue: 1, fields: { salary: 100 }, updatedAt: '2026-04-12' }];
    const tgt: SyncRow[] = [{ pkValue: 1, fields: { salary: 200 }, updatedAt: '2026-04-12' }];
    const delta = engine.computeDelta(src, tgt, 'manual');
    expect(delta.conflicts).toHaveLength(1);
  });

  it('newest-wins 정책', () => {
    const src: SyncRow[] = [{ pkValue: 1, fields: { salary: 500 }, updatedAt: '2026-04-12' }];
    const tgt: SyncRow[] = [{ pkValue: 1, fields: { salary: 100 }, updatedAt: '2026-04-10' }];
    const delta = engine.computeDelta(src, tgt, 'newest-wins');
    expect(delta.updates).toHaveLength(1);
  });

  it('없는 컬럼 거부', () => {
    expect(() => engine.translateType(source, 'postgres', 'unknown')).toThrow('COLUMN_NOT_FOUND');
  });
});
