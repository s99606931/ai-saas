// SVC-AI-ADV-R483 Statistical Integrity Verifier
// Design Ref: SVC-AI-ADV-R483.design.md §통계무결성
// Plan SC: FR-483.1~6
// CSAP D-06 / N2SF N-05

export type DataGrade = 'O' | 'C' | 'S';

export interface StatisticalDataset {
  readonly datasetId: string;
  readonly values: readonly number[];
  readonly reportedMean: number;
  readonly reportedStdDev: number;
  readonly source: string;
}

export interface IntegrityReport {
  readonly datasetId: string;
  readonly computedMean: number;
  readonly computedStdDev: number;
  readonly meanDelta: number;
  readonly stdDevDelta: number;
  readonly anomalies: number;
  readonly verdict: 'VALID' | 'SUSPICIOUS' | 'INVALID';
}

interface AuditEntry {
  readonly timestamp: string;
  readonly action: string;
  readonly details: Record<string, unknown>;
}

function block(grade: DataGrade): void {
  if (grade === 'C' || grade === 'S') {
    throw new Error(`N2SF_BLOCKED: ${grade}등급 통계 데이터 차단 (N2SF N-05)`);
  }
}

function mean(values: readonly number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function stdDev(values: readonly number[], mu: number): number {
  if (values.length === 0) return 0;
  const variance = values.reduce((acc, v) => acc + (v - mu) ** 2, 0) / values.length;
  return Math.sqrt(variance);
}

export class StatisticalIntegrityVerifier {
  private readonly auditLog: AuditEntry[] = [];

  verify(dataset: StatisticalDataset, grade: DataGrade = 'O'): IntegrityReport {
    block(grade);

    const computedMean = mean(dataset.values);
    const computedStdDev = stdDev(dataset.values, computedMean);

    const meanDelta = Math.abs(computedMean - dataset.reportedMean);
    const stdDevDelta = Math.abs(computedStdDev - dataset.reportedStdDev);

    let anomalies = 0;
    for (const v of dataset.values) {
      if (computedStdDev > 0 && Math.abs(v - computedMean) > 3 * computedStdDev) {
        anomalies += 1;
      }
    }

    const meanTol = Math.max(0.01, Math.abs(dataset.reportedMean) * 0.01);
    const stdTol = Math.max(0.01, Math.abs(dataset.reportedStdDev) * 0.05);

    const verdict: IntegrityReport['verdict'] =
      meanDelta > meanTol * 10 || stdDevDelta > stdTol * 10
        ? 'INVALID'
        : meanDelta > meanTol || stdDevDelta > stdTol
          ? 'SUSPICIOUS'
          : 'VALID';

    this.appendAudit('STAT_VERIFY', {
      datasetId: dataset.datasetId,
      verdict,
      anomalies,
    });

    return {
      datasetId: dataset.datasetId,
      computedMean,
      computedStdDev,
      meanDelta,
      stdDevDelta,
      anomalies,
      verdict,
    };
  }

  benfordCheck(values: readonly number[]): number {
    const digits = values
      .map((v) => Math.abs(Math.trunc(v)))
      .filter((v) => v > 0)
      .map((v) => parseInt(String(v).charAt(0), 10))
      .filter((d) => d >= 1 && d <= 9);

    if (digits.length === 0) return 0;
    const counts = new Array<number>(10).fill(0);
    for (const d of digits) counts[d] = (counts[d] ?? 0) + 1;

    const expected = [0, 0.301, 0.176, 0.125, 0.097, 0.079, 0.067, 0.058, 0.051, 0.046];
    let chi = 0;
    for (let d = 1; d <= 9; d += 1) {
      const exp = (expected[d] ?? 0) * digits.length;
      const obs = counts[d] ?? 0;
      if (exp > 0) chi += ((obs - exp) ** 2) / exp;
    }
    this.appendAudit('BENFORD', { n: digits.length, chi });
    return Math.round(chi * 100) / 100;
  }

  getAuditLog(): readonly AuditEntry[] {
    return [...this.auditLog];
  }

  private appendAudit(action: string, details: Record<string, unknown>): void {
    this.auditLog.push({
      timestamp: new Date().toISOString(),
      action,
      details,
    });
  }
}
