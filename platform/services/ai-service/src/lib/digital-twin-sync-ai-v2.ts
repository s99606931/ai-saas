// Design Ref: SVC-AI-ADV-R646.design.md — AI기반 디지털 트윈 동기화 v2
// Plan SC: FR-R646.1~5

export type SyncStatus = 'SYNCED' | 'DRIFT' | 'OUT_OF_SYNC';

interface TwinEntity { entityId: string; name: string; baselineState: number }
interface SyncSample { value: number; delta: number; timestamp: string }
interface SyncResult { entityId: string; avgDelta: number; status: SyncStatus; samples: number }
interface AuditEntry { timestamp: string; action: string; details?: Record<string, unknown> }

export class DigitalTwinSyncAIV2 {
  private entities = new Map<string, TwinEntity>();
  private samples = new Map<string, SyncSample[]>();
  private auditLog: AuditEntry[] = [];

  registerEntity(entityId: string, name: string, baselineState: number): void {
    this.entities.set(entityId, { entityId, name, baselineState });
    this.samples.set(entityId, []);
    this.auditLog.push({
      timestamp: new Date().toISOString(),
      action: 'REGISTER_ENTITY',
      details: { entityId, name, baselineState },
    });
  }

  ingestSample(entityId: string, value: number, dataGrade?: string): void {
    if (dataGrade === 'C' || dataGrade === 'S') {
      throw new Error(`BLOCKED: ${dataGrade}등급 AI API 전송 금지 (N2SF N-05)`);
    }
    const entity = this.entities.get(entityId);
    if (!entity) throw new Error(`UNKNOWN_ENTITY: ${entityId}`);
    const delta = Math.abs(value - entity.baselineState);
    const list = this.samples.get(entityId) ?? [];
    list.push({ value, delta, timestamp: new Date().toISOString() });
    this.samples.set(entityId, list);
    this.auditLog.push({
      timestamp: new Date().toISOString(),
      action: 'INGEST_SAMPLE',
      details: { entityId, value, delta },
    });
  }

  evaluate(entityId: string): SyncResult {
    const list = this.samples.get(entityId) ?? [];
    const recent = list.slice(-5);
    if (recent.length === 0) {
      return { entityId, avgDelta: 0, status: 'SYNCED', samples: 0 };
    }
    const avgDelta = recent.reduce((s, r) => s + r.delta, 0) / recent.length;
    let status: SyncStatus;
    if (avgDelta <= 0.05) status = 'SYNCED';
    else if (avgDelta <= 0.15) status = 'DRIFT';
    else status = 'OUT_OF_SYNC';
    this.auditLog.push({
      timestamp: new Date().toISOString(),
      action: 'EVALUATE',
      details: { entityId, avgDelta, status },
    });
    return { entityId, avgDelta, status, samples: recent.length };
  }

  getAuditLog(): AuditEntry[] {
    return [...this.auditLog];
  }
}
