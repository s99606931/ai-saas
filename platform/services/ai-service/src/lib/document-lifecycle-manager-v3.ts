// Design Ref: SVC-AI-ADV-R608-v3.design.md §알고리즘
// Plan SC: SC-R608v3-1, SC-R608v3-2, SC-R608v3-3
// 트랙 A 22차

export type DocClassification = 'PERMANENT' | 'STANDARD';
export type DocStage = 'ACTIVE' | 'REVIEW' | 'DISPOSAL' | 'ARCHIVE';

export interface DocItem {
  id: string;
  createdAt: string;
  retentionYears: number;
  accessCount: number;
  classification: DocClassification;
}

export interface DocStageResult {
  id: string;
  stage: DocStage;
}

export interface LifecycleResult {
  totalDocs: number;
  disposalCandidates: string[];
  items: DocStageResult[];
}

export interface AuditEntry {
  timestamp: string;
  action: string;
  actor?: string;
  details?: Record<string, unknown>;
}

const YEAR_MS = 365 * 86_400_000;

export class DocumentLifecycleManagerV3 {
  private readonly auditLog: AuditEntry[] = [];

  classify(docs: DocItem[], now: Date = new Date()): LifecycleResult {
    const items: DocStageResult[] = docs.map((d) => {
      let stage: DocStage;
      if (d.classification === 'PERMANENT') {
        stage = 'ARCHIVE';
      } else {
        const ageYears = (now.getTime() - new Date(d.createdAt).getTime()) / YEAR_MS;
        if (ageYears >= d.retentionYears) stage = 'DISPOSAL';
        else if (ageYears >= d.retentionYears * 0.8) stage = 'REVIEW';
        else stage = 'ACTIVE';
      }
      return { id: d.id, stage };
    });

    const disposalCandidates = items.filter((i) => i.stage === 'DISPOSAL').map((i) => i.id);

    this.auditLog.push({
      timestamp: new Date().toISOString(),
      action: 'LIFECYCLE_CLASSIFY',
      details: { totalDocs: docs.length, disposalCount: disposalCandidates.length },
    });

    return {
      totalDocs: docs.length,
      disposalCandidates,
      items,
    };
  }

  getAuditLog(): AuditEntry[] {
    return [...this.auditLog];
  }
}
