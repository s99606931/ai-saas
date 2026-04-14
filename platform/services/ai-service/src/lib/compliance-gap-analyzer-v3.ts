// Design Ref: SVC-AI-ADV-R604-v3.design.md §알고리즘
// Plan SC: SC-R604v3-1, SC-R604v3-2, SC-R604v3-3
// 트랙 A 22차

export type Severity = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';

export interface ControlItem {
  id: string;
  required: boolean;
  implemented: boolean;
  severity: Severity;
}

export interface GapResult {
  totalControls: number;
  gaps: number;
  gapScore: number;
  prioritized: string[];
}

export interface AuditEntry {
  timestamp: string;
  action: string;
  actor?: string;
  details?: Record<string, unknown>;
}

const WEIGHT: Record<Severity, number> = {
  CRITICAL: 10,
  HIGH: 5,
  MEDIUM: 2,
  LOW: 1,
};

const RANK: Record<Severity, number> = {
  CRITICAL: 4,
  HIGH: 3,
  MEDIUM: 2,
  LOW: 1,
};

export class ComplianceGapAnalyzerV3 {
  private readonly auditLog: AuditEntry[] = [];

  analyze(controls: ControlItem[]): GapResult {
    const gapItems = controls.filter((c) => c.required && !c.implemented);
    const gapScore = gapItems.reduce((sum, c) => sum + WEIGHT[c.severity], 0);
    const prioritized = [...gapItems]
      .sort((a, b) => {
        const r = RANK[b.severity] - RANK[a.severity];
        if (r !== 0) return r;
        return a.id.localeCompare(b.id);
      })
      .map((c) => c.id);

    const result: GapResult = {
      totalControls: controls.length,
      gaps: gapItems.length,
      gapScore,
      prioritized,
    };

    this.auditLog.push({
      timestamp: new Date().toISOString(),
      action: 'GAP_ANALYZE',
      details: { totalControls: result.totalControls, gaps: result.gaps, gapScore },
    });

    return result;
  }

  getAuditLog(): AuditEntry[] {
    return [...this.auditLog];
  }
}
