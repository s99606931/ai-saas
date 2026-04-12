// Design Ref: §핵심 알고리즘 — 버전 벡터 충돌 탐지 + 동기화 계획
// Plan SC: FR-R220.1~5

enum DataGrade { C = 'C', S = 'S', O = 'O' }

type SyncStrategy = 'last-write-wins' | 'merge';

interface DataSource {
  id: string;
  name: string;
  cloudProvider: string;
  region: string;
}

interface ChangeRecord {
  sourceId: string;
  resourceId: string;
  version: number;
  data: Record<string, unknown>;
  timestamp: string;
}

interface ConflictResult {
  resourceId: string;
  conflictingChanges: ChangeRecord[];
  conflictType: 'concurrent_modification';
}

interface SyncStep {
  action: 'write' | 'merge' | 'skip';
  sourceId: string;
  resourceId: string;
  data: Record<string, unknown>;
  reason: string;
}

interface SyncPlan {
  resourceId: string;
  strategy: SyncStrategy;
  steps: SyncStep[];
  hasConflicts: boolean;
}

interface AuditEntry {
  timestamp: string;
  action: string;
  details: Record<string, unknown>;
}

// Plan SC: FR-R220.5
function guardDataGrade(grade: DataGrade): void {
  if (grade === DataGrade.C || grade === DataGrade.S) {
    throw new Error(`BLOCKED: ${grade}등급 데이터는 AI API 전송 금지 (N2SF N-05)`);
  }
}

export class MulticloudDataSyncAI {
  private dataSources = new Map<string, DataSource>();
  private changes: ChangeRecord[] = [];
  private auditLog: AuditEntry[] = [];

  private log(action: string, details: Record<string, unknown>): void {
    this.auditLog.push({ timestamp: new Date().toISOString(), action, details });
  }

  // Plan SC: FR-R220.1
  registerDataSource(id: string, name: string, cloudProvider: string, region: string): void {
    this.dataSources.set(id, { id, name, cloudProvider, region });
    this.log('REGISTER_DATA_SOURCE', { id, name, cloudProvider, region });
  }

  // Plan SC: FR-R220.2
  recordChange(sourceId: string, resourceId: string, version: number, data: Record<string, unknown>, grade: DataGrade = DataGrade.O): void {
    guardDataGrade(grade);

    if (!this.dataSources.has(sourceId)) {
      throw new Error(`데이터소스 미등록: ${sourceId}`);
    }

    this.changes.push({ sourceId, resourceId, version, data, timestamp: new Date().toISOString() });
    this.log('RECORD_CHANGE', { sourceId, resourceId, version });
  }

  // Plan SC: FR-R220.3
  detectConflicts(resourceId: string): ConflictResult[] {
    const resourceChanges = this.changes.filter(c => c.resourceId === resourceId);
    const sourcesWithChanges = new Map<string, ChangeRecord>();

    for (const change of resourceChanges) {
      if (!sourcesWithChanges.has(change.sourceId)) {
        sourcesWithChanges.set(change.sourceId, change);
      } else {
        const existing = sourcesWithChanges.get(change.sourceId)!;
        if (change.version > existing.version) {
          sourcesWithChanges.set(change.sourceId, change);
        }
      }
    }

    const uniqueChanges = Array.from(sourcesWithChanges.values());
    if (uniqueChanges.length < 2) {
      this.log('DETECT_CONFLICTS', { resourceId, conflicts: 0 });
      return [];
    }

    const versions = new Set(uniqueChanges.map(c => c.version));
    if (versions.size > 1) {
      const result: ConflictResult = {
        resourceId,
        conflictingChanges: uniqueChanges,
        conflictType: 'concurrent_modification',
      };
      this.log('DETECT_CONFLICTS', { resourceId, conflicts: 1 });
      return [result];
    }

    this.log('DETECT_CONFLICTS', { resourceId, conflicts: 0 });
    return [];
  }

  // Plan SC: FR-R220.4
  generateSyncPlan(resourceId: string, strategy: SyncStrategy = 'last-write-wins'): SyncPlan {
    const conflicts = this.detectConflicts(resourceId);
    const resourceChanges = this.changes.filter(c => c.resourceId === resourceId);

    if (resourceChanges.length === 0) {
      return { resourceId, strategy, steps: [], hasConflicts: false };
    }

    const steps: SyncStep[] = [];

    if (strategy === 'last-write-wins') {
      const latest = resourceChanges.reduce((a, b) =>
        new Date(a.timestamp) > new Date(b.timestamp) ? a : b
      );
      for (const source of this.dataSources.keys()) {
        if (source !== latest.sourceId) {
          steps.push({
            action: 'write',
            sourceId: source,
            resourceId,
            data: latest.data,
            reason: `최신 변경(${latest.sourceId})으로 덮어쓰기`,
          });
        }
      }
    } else {
      const mergedData: Record<string, unknown> = {};
      for (const change of resourceChanges) {
        Object.assign(mergedData, change.data);
      }
      for (const source of this.dataSources.keys()) {
        steps.push({
          action: 'merge',
          sourceId: source,
          resourceId,
          data: mergedData,
          reason: '전체 변경 병합',
        });
      }
    }

    this.log('GENERATE_SYNC_PLAN', { resourceId, strategy, steps: steps.length });
    return { resourceId, strategy, steps, hasConflicts: conflicts.length > 0 };
  }

  // Plan SC: FR-R220.5
  getAuditLog(): AuditEntry[] {
    return [...this.auditLog];
  }
}
