// SVC-AI-ADV-R463 Public Health Emergency Detector
// Design Ref: SVC-AI-ADV-R463.design.md
// Plan SC: FR-463.1~5
// CSAP D-06 / N2SF N-05

export type DataGrade = 'O' | 'C' | 'S';

export interface SymptomReport {
  readonly date: string;
  readonly symptom: string;
  readonly count: number;
  readonly regionId: string;
}

export interface Anomaly {
  readonly symptom: string;
  readonly regionId: string;
  readonly recentCount: number;
  readonly baseline: number;
  readonly ratio: number;
}

export type AlertLevel = 'normal' | 'warning' | 'critical';

export interface DetectResult {
  readonly alertLevel: AlertLevel;
  readonly anomalies: readonly Anomaly[];
}

interface AuditEntry {
  readonly timestamp: string;
  readonly action: string;
  readonly details: Record<string, unknown>;
}

export class PublicHealthEmergencyDetector {
  private readonly auditLog: AuditEntry[] = [];

  detect(reports: readonly SymptomReport[], grade: DataGrade = 'O'): DetectResult {
    if (grade === 'C' || grade === 'S') {
      throw new Error(`N2SF_BLOCKED: ${grade}등급 보건 데이터 차단 (N2SF N-05)`);
    }

    const groups = new Map<string, SymptomReport[]>();
    for (const r of reports) {
      if (r.count < 0) throw new Error(`INVALID_COUNT: ${r.symptom}`);
      const key = `${r.symptom}|${r.regionId}`;
      const arr = groups.get(key) ?? [];
      arr.push(r);
      groups.set(key, arr);
    }

    const anomalies: Anomaly[] = [];
    for (const [key, arr] of groups) {
      if (arr.length < 2) continue;
      const sorted = [...arr].sort((a, b) => a.date.localeCompare(b.date));
      const recent = sorted[sorted.length - 1];
      if (!recent) continue;
      const priors = sorted.slice(0, -1);
      const baseline = priors.reduce((s, x) => s + x.count, 0) / priors.length;
      if (baseline <= 0) continue;
      const ratio = recent.count / baseline;
      if (ratio > 3) {
        const parts = key.split('|');
        anomalies.push({
          symptom: parts[0] ?? '',
          regionId: parts[1] ?? '',
          recentCount: recent.count,
          baseline: Number(baseline.toFixed(2)),
          ratio: Number(ratio.toFixed(2)),
        });
      }
    }

    let alertLevel: AlertLevel = 'normal';
    if (anomalies.length >= 5) alertLevel = 'critical';
    else if (anomalies.length >= 2) alertLevel = 'warning';

    this.auditLog.push({
      timestamp: new Date().toISOString(),
      action: 'HEALTH_DETECT',
      details: { alertLevel, anomalies: anomalies.length },
    });

    return { alertLevel, anomalies };
  }

  getAuditLog(): readonly AuditEntry[] {
    return [...this.auditLog];
  }
}
