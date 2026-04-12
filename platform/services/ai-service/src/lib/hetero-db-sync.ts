// 이종 DB 동기화 AI 엔진 — FR-N409.1~5

export type DbDialect = 'postgres' | 'mysql' | 'oracle' | 'mssql' | 'tibero';

export interface ColumnDef {
  name: string;
  type: string;
  nullable: boolean;
  primaryKey: boolean;
}

export interface TableSchema {
  dialect: DbDialect;
  table: string;
  columns: ColumnDef[];
}

export interface TypeMappingRule {
  fromDialect: DbDialect;
  fromType: string;
  toDialect: DbDialect;
  toType: string;
}

export type ConflictPolicy = 'source-wins' | 'target-wins' | 'newest-wins' | 'manual';

export interface SyncRow {
  pkValue: string | number;
  fields: Record<string, unknown>;
  updatedAt?: string;
}

export interface SyncDelta {
  inserts: SyncRow[];
  updates: SyncRow[];
  deletes: Array<string | number>;
  conflicts: Array<{ pk: string | number; reason: string }>;
}

export class HeteroDbSyncEngine {
  private readonly rules: TypeMappingRule[] = [];

  addTypeMapping(rule: TypeMappingRule): void {
    this.rules.push(rule);
  }

  translateType(source: TableSchema, target: DbDialect, column: string): string {
    const col = source.columns.find((c) => c.name === column);
    if (!col) throw new Error('SYNC_COLUMN_NOT_FOUND');
    const rule = this.rules.find(
      (r) => r.fromDialect === source.dialect && r.fromType === col.type && r.toDialect === target,
    );
    return rule?.toType ?? col.type;
  }

  computeDelta(source: SyncRow[], target: SyncRow[], policy: ConflictPolicy): SyncDelta {
    const targetMap = new Map<string | number, SyncRow>();
    for (const row of target) targetMap.set(row.pkValue, row);
    const sourcePks = new Set<string | number>();

    const inserts: SyncRow[] = [];
    const updates: SyncRow[] = [];
    const conflicts: Array<{ pk: string | number; reason: string }> = [];

    for (const s of source) {
      sourcePks.add(s.pkValue);
      const t = targetMap.get(s.pkValue);
      if (!t) {
        inserts.push(s);
        continue;
      }
      const same = this.rowsEqual(s, t);
      if (same) continue;

      const resolved = this.resolveConflict(s, t, policy);
      if (resolved === 'manual') {
        conflicts.push({ pk: s.pkValue, reason: 'MANUAL_REQUIRED' });
      } else if (resolved === 'source') {
        updates.push(s);
      } else {
        // target-wins: skip
      }
    }

    const deletes: Array<string | number> = [];
    for (const pk of targetMap.keys()) {
      if (!sourcePks.has(pk)) deletes.push(pk);
    }

    return { inserts, updates, deletes, conflicts };
  }

  private rowsEqual(a: SyncRow, b: SyncRow): boolean {
    const aKeys = Object.keys(a.fields).sort();
    const bKeys = Object.keys(b.fields).sort();
    if (aKeys.length !== bKeys.length) return false;
    return aKeys.every((k) => JSON.stringify(a.fields[k]) === JSON.stringify(b.fields[k]));
  }

  private resolveConflict(
    source: SyncRow,
    target: SyncRow,
    policy: ConflictPolicy,
  ): 'source' | 'target' | 'manual' {
    if (policy === 'source-wins') return 'source';
    if (policy === 'target-wins') return 'target';
    if (policy === 'manual') return 'manual';
    const s = source.updatedAt ?? '';
    const t = target.updatedAt ?? '';
    return s >= t ? 'source' : 'target';
  }
}
