// 데이터 카탈로그 AI — FR-N400.1~5

export type DataClass = 'public' | 'internal' | 'pii' | 'financial' | 'medical';

export interface CatalogColumn {
  name: string;
  dataType: string;
  nullable: boolean;
  description?: string;
  dataClass: DataClass;
  tags: string[];
}

export interface CatalogTable {
  database: string;
  schema: string;
  name: string;
  description?: string;
  columns: CatalogColumn[];
  owner?: string;
  tags: string[];
  upstreams: string[];
  downstreams: string[];
}

export interface CatalogSearchQuery {
  keyword?: string;
  dataClass?: DataClass;
  tag?: string;
}

const PII_PATTERNS = [/name/i, /email/i, /phone/i, /address/i, /rrn/i, /ssn/i, /birth/i];
const FINANCIAL_PATTERNS = [/account/i, /card/i, /iban/i, /amount/i, /salary/i, /tax/i];
const MEDICAL_PATTERNS = [/diagnosis/i, /prescription/i, /blood/i, /disease/i];

export class DataCatalogAi {
  private readonly tables = new Map<string, CatalogTable>();

  ingest(raw: Omit<CatalogTable, 'tags' | 'upstreams' | 'downstreams'>): CatalogTable {
    if (raw.columns.length === 0) throw new Error('CATALOG_EMPTY_COLUMNS');
    const key = `${raw.database}.${raw.schema}.${raw.name}`;
    const enriched: CatalogTable = {
      ...raw,
      description: raw.description ?? this.generateTableDescription(raw.name, raw.columns),
      columns: raw.columns.map((c) => this.classifyColumn(c)),
      tags: this.deriveTableTags(raw.name, raw.columns),
      upstreams: [],
      downstreams: [],
    };
    this.tables.set(key, enriched);
    return enriched;
  }

  linkLineage(fromKey: string, toKey: string): void {
    const from = this.tables.get(fromKey);
    const to = this.tables.get(toKey);
    if (!from || !to) throw new Error('CATALOG_TABLE_NOT_FOUND');
    if (!from.downstreams.includes(toKey)) from.downstreams.push(toKey);
    if (!to.upstreams.includes(fromKey)) to.upstreams.push(fromKey);
  }

  search(query: CatalogSearchQuery): CatalogTable[] {
    const keyword = query.keyword?.toLowerCase();
    return Array.from(this.tables.values()).filter((t) => {
      if (keyword) {
        const hay = `${t.name} ${t.description ?? ''} ${t.columns.map((c) => c.name).join(' ')}`.toLowerCase();
        if (!hay.includes(keyword)) return false;
      }
      if (query.dataClass) {
        if (!t.columns.some((c) => c.dataClass === query.dataClass)) return false;
      }
      if (query.tag) {
        if (!t.tags.includes(query.tag)) return false;
      }
      return true;
    });
  }

  piiColumns(): Array<{ table: string; column: string; dataClass: DataClass }> {
    const out: Array<{ table: string; column: string; dataClass: DataClass }> = [];
    for (const table of this.tables.values()) {
      const key = `${table.database}.${table.schema}.${table.name}`;
      for (const col of table.columns) {
        if (col.dataClass === 'pii' || col.dataClass === 'financial' || col.dataClass === 'medical') {
          out.push({ table: key, column: col.name, dataClass: col.dataClass });
        }
      }
    }
    return out;
  }

  private classifyColumn(col: CatalogColumn): CatalogColumn {
    let dataClass: DataClass = col.dataClass || 'internal';
    if (dataClass === 'internal') {
      if (MEDICAL_PATTERNS.some((p) => p.test(col.name))) dataClass = 'medical';
      else if (FINANCIAL_PATTERNS.some((p) => p.test(col.name))) dataClass = 'financial';
      else if (PII_PATTERNS.some((p) => p.test(col.name))) dataClass = 'pii';
    }
    return {
      ...col,
      dataClass,
      description: col.description ?? this.describeColumn(col.name, col.dataType),
      tags: Array.from(new Set([...col.tags, dataClass])),
    };
  }

  private describeColumn(name: string, dataType: string): string {
    return `${name} 컬럼 (${dataType})`;
  }

  private generateTableDescription(name: string, columns: CatalogColumn[]): string {
    return `${name} 테이블 — 컬럼 ${columns.length}개`;
  }

  private deriveTableTags(name: string, columns: CatalogColumn[]): string[] {
    const tags = new Set<string>();
    if (/user|member/i.test(name)) tags.add('user-data');
    if (/order|payment/i.test(name)) tags.add('transaction');
    if (/log|event/i.test(name)) tags.add('telemetry');
    for (const col of columns) {
      if (PII_PATTERNS.some((p) => p.test(col.name))) tags.add('contains-pii');
    }
    return Array.from(tags);
  }
}
