// SVC-AI-ADV-R461 Public Safety Incident Tracker
// Design Ref: SVC-AI-ADV-R461.design.md
// Plan SC: FR-461.1~5
// CSAP D-06 / N2SF N-05

export type DataGrade = 'O' | 'C' | 'S';

export interface Incident {
  readonly id: string;
  readonly category: string;
  readonly regionId: string;
  readonly timestamp: string;
  readonly severity: 1 | 2 | 3 | 4 | 5;
}

export interface PatternAlert {
  readonly category: string;
  readonly regionId: string;
  readonly count: number;
  readonly avgSeverity: number;
  readonly hotspot: boolean;
}

export interface TrackResult {
  readonly totalIncidents: number;
  readonly alerts: readonly PatternAlert[];
  readonly topRiskRegion: string | null;
}

interface AuditEntry {
  readonly timestamp: string;
  readonly action: string;
  readonly details: Record<string, unknown>;
}

export class PublicSafetyIncidentTracker {
  private readonly auditLog: AuditEntry[] = [];
  private readonly threshold: number;

  constructor(threshold = 3) {
    this.threshold = threshold;
  }

  track(incidents: readonly Incident[], grade: DataGrade = 'O'): TrackResult {
    if (grade === 'C' || grade === 'S') {
      throw new Error(`N2SF_BLOCKED: ${grade}등급 사건 데이터 차단 (N2SF N-05)`);
    }

    const groups = new Map<string, Incident[]>();
    for (const inc of incidents) {
      if (inc.severity < 1 || inc.severity > 5) {
        throw new Error(`INVALID_SEVERITY: ${inc.id}`);
      }
      const key = `${inc.category}|${inc.regionId}`;
      const arr = groups.get(key) ?? [];
      arr.push(inc);
      groups.set(key, arr);
    }

    const alerts: PatternAlert[] = [];
    const regionCounts = new Map<string, number>();
    for (const [key, arr] of groups) {
      const parts = key.split('|');
      const category = parts[0] ?? '';
      const regionId = parts[1] ?? '';
      regionCounts.set(regionId, (regionCounts.get(regionId) ?? 0) + arr.length);
      if (arr.length > this.threshold) {
        const avg = arr.reduce((s, i) => s + i.severity, 0) / arr.length;
        alerts.push({
          category,
          regionId,
          count: arr.length,
          avgSeverity: Number(avg.toFixed(2)),
          hotspot: avg >= 4,
        });
      }
    }

    let topRiskRegion: string | null = null;
    let max = 0;
    for (const [region, cnt] of regionCounts) {
      if (cnt > max) {
        max = cnt;
        topRiskRegion = region;
      }
    }

    this.auditLog.push({
      timestamp: new Date().toISOString(),
      action: 'INCIDENT_TRACK',
      details: { total: incidents.length, alerts: alerts.length },
    });

    return { totalIncidents: incidents.length, alerts, topRiskRegion };
  }

  getAuditLog(): readonly AuditEntry[] {
    return [...this.auditLog];
  }
}
