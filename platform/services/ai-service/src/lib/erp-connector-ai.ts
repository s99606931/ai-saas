// ERP/그룹웨어 AI 커넥터 — FR-N407.1~5

export type ErpSystemKind = 'sap' | 'douzone' | 'ksystem' | 'oracle_ebs' | 'custom';

export interface FieldMapping {
  externalField: string;
  internalField: string;
  transform?: (v: unknown) => unknown;
}

export interface ErpAdapter {
  id: string;
  kind: ErpSystemKind;
  baseUrl: string;
  mappings: FieldMapping[];
  auth: { type: 'bearer' | 'basic' | 'api_key'; credentialRef: string };
}

export interface FetchOptions {
  entity: string;
  filters?: Record<string, unknown>;
  limit?: number;
}

export interface SyncResult {
  adapterId: string;
  entity: string;
  fetched: number;
  mapped: number;
  errors: Array<{ row: number; reason: string }>;
}

export type ErpFetcher = (
  adapter: ErpAdapter,
  options: FetchOptions,
) => Promise<Array<Record<string, unknown>>>;

export class ErpConnectorAi {
  private readonly adapters = new Map<string, ErpAdapter>();
  private readonly auditLog: Array<{ ts: string; adapterId: string; entity: string; count: number }> = [];

  constructor(private readonly fetcher: ErpFetcher) {}

  register(adapter: ErpAdapter): void {
    if (!adapter.baseUrl.startsWith('https://')) throw new Error('ERP_INSECURE_URL');
    if (adapter.mappings.length === 0) throw new Error('ERP_NO_MAPPINGS');
    this.adapters.set(adapter.id, adapter);
  }

  async sync(adapterId: string, options: FetchOptions): Promise<{ records: Array<Record<string, unknown>>; result: SyncResult }> {
    const adapter = this.adapters.get(adapterId);
    if (!adapter) throw new Error('ERP_ADAPTER_NOT_FOUND');
    const raw = await this.fetchWithRetry(adapter, options, 3);
    const errors: Array<{ row: number; reason: string }> = [];
    const records: Array<Record<string, unknown>> = [];
    raw.forEach((row, idx) => {
      try {
        records.push(this.mapRow(adapter, row));
      } catch (e) {
        errors.push({ row: idx, reason: (e as Error).message });
      }
    });
    const result: SyncResult = {
      adapterId,
      entity: options.entity,
      fetched: raw.length,
      mapped: records.length,
      errors,
    };
    this.auditLog.push({
      ts: new Date().toISOString(),
      adapterId,
      entity: options.entity,
      count: records.length,
    });
    return { records, result };
  }

  getAuditLog(): ReadonlyArray<{ ts: string; adapterId: string; entity: string; count: number }> {
    return this.auditLog;
  }

  private async fetchWithRetry(
    adapter: ErpAdapter,
    options: FetchOptions,
    maxAttempts: number,
  ): Promise<Array<Record<string, unknown>>> {
    let lastError: Error | undefined;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        return await this.fetcher(adapter, options);
      } catch (e) {
        lastError = e as Error;
      }
    }
    throw new Error(`ERP_FETCH_FAILED:${lastError?.message ?? 'unknown'}`);
  }

  private mapRow(adapter: ErpAdapter, row: Record<string, unknown>): Record<string, unknown> {
    const out: Record<string, unknown> = {};
    for (const m of adapter.mappings) {
      const raw = row[m.externalField];
      if (raw === undefined) {
        throw new Error(`MAPPING_MISSING_FIELD:${m.externalField}`);
      }
      out[m.internalField] = m.transform ? m.transform(raw) : raw;
    }
    return out;
  }
}
