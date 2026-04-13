// SVC-AI-ADV-R440 Smart City Integrated Dashboard AI
// Design Ref: SVC-AI-ADV-R440.design.md
// Plan SC: FR-440.1~5
// CSAP D-06 / N2SF N-05

export type DataGrade = 'O' | 'C' | 'S';

export interface KPI {
  readonly domain: string;
  readonly name: string;
  readonly value: number;
  readonly baseline: number;
  readonly stddev: number;
}

export interface Anomaly {
  readonly domain: string;
  readonly name: string;
  readonly z: number;
}

export interface Snapshot {
  readonly cityIndex: number;
  readonly domainScores: Record<string, number>;
  readonly anomalies: readonly Anomaly[];
  readonly totalKpis: number;
}

export interface AuditEntry {
  readonly timestamp: string;
  readonly action: string;
  readonly target: string;
  readonly details: Record<string, unknown>;
}

export class SmartCityDashboardAI {
  private readonly auditLog: AuditEntry[] = [];

  snapshot(kpis: readonly KPI[], grade: DataGrade = 'O'): Snapshot {
    if (grade === 'C' || grade === 'S') {
      throw new Error(`N2SF_BLOCKED: ${grade}등급 도시 데이터 차단 (N2SF N-05)`);
    }
    if (kpis.length === 0) {
      return { cityIndex: 0, domainScores: {}, anomalies: [], totalKpis: 0 };
    }

    const anomalies: Anomaly[] = [];
    const byDomain = new Map<string, number[]>();

    for (const k of kpis) {
      if (k.stddev <= 0) throw new Error(`INVALID_STDDEV: ${k.name}`);
      const z = (k.value - k.baseline) / k.stddev;
      const zAbs = Math.abs(z);
      if (zAbs >= 2) {
        anomalies.push({ domain: k.domain, name: k.name, z: Number(z.toFixed(4)) });
      }
      const score = 1 - Math.min(zAbs, 3) / 3;
      if (!byDomain.has(k.domain)) byDomain.set(k.domain, []);
      byDomain.get(k.domain)!.push(score);
    }

    const domainScores: Record<string, number> = {};
    let sum = 0;
    for (const [d, scores] of byDomain) {
      const avg = scores.reduce((s, x) => s + x, 0) / scores.length;
      domainScores[d] = Number(avg.toFixed(4));
      sum += avg;
    }
    const cityIndex = Number((sum / byDomain.size).toFixed(4));

    this.record('SNAPSHOT', 'city', {
      anomalies: anomalies.length,
      cityIndex,
    });
    return { cityIndex, domainScores, anomalies, totalKpis: kpis.length };
  }

  getAuditLog(): readonly AuditEntry[] {
    return this.auditLog;
  }

  private record(action: string, target: string, details: Record<string, unknown>): void {
    this.auditLog.push({
      timestamp: new Date().toISOString(),
      action,
      target,
      details,
    });
  }
}
