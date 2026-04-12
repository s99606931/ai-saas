// 실시간 데이터 품질 모니터링 — FR-N399.1~5 (Great Expectations 패턴)

export type ExpectationType =
  | 'not_null'
  | 'unique'
  | 'range'
  | 'regex'
  | 'categorical'
  | 'length';

export interface Expectation {
  id: string;
  column: string;
  type: ExpectationType;
  params: Record<string, unknown>;
  severity: 'warn' | 'error';
}

export interface QualityReport {
  dataset: string;
  rowCount: number;
  expectationResults: ExpectationResult[];
  qualityScore: number;
  driftDetected: boolean;
}

export interface ExpectationResult {
  expectationId: string;
  passed: boolean;
  failureCount: number;
  details: string;
}

export type DataRow = Record<string, unknown>;

export class DataQualityMonitor {
  private readonly historyStats = new Map<string, { mean: number; count: number }>();

  run(dataset: string, rows: DataRow[], expectations: Expectation[]): QualityReport {
    if (rows.length === 0) throw new Error('DQ_EMPTY_DATASET');
    const results: ExpectationResult[] = [];
    for (const exp of expectations) {
      results.push(this.evaluate(exp, rows));
    }
    const passed = results.filter((r) => r.passed).length;
    const qualityScore = results.length > 0 ? passed / results.length : 1;
    const driftDetected = this.detectDrift(dataset, rows);
    return {
      dataset,
      rowCount: rows.length,
      expectationResults: results,
      qualityScore: Number(qualityScore.toFixed(3)),
      driftDetected,
    };
  }

  private evaluate(exp: Expectation, rows: DataRow[]): ExpectationResult {
    let failures = 0;
    let detail = '';
    switch (exp.type) {
      case 'not_null':
        failures = rows.filter((r) => r[exp.column] === null || r[exp.column] === undefined).length;
        detail = `null ${failures}건`;
        break;
      case 'unique': {
        const seen = new Set<unknown>();
        for (const r of rows) {
          const v = r[exp.column];
          if (seen.has(v)) failures += 1;
          seen.add(v);
        }
        detail = `중복 ${failures}건`;
        break;
      }
      case 'range': {
        const min = Number(exp.params['min'] ?? Number.NEGATIVE_INFINITY);
        const max = Number(exp.params['max'] ?? Number.POSITIVE_INFINITY);
        for (const r of rows) {
          const v = Number(r[exp.column]);
          if (Number.isNaN(v) || v < min || v > max) failures += 1;
        }
        detail = `범위 이탈 ${failures}건`;
        break;
      }
      case 'regex': {
        const pattern = new RegExp(String(exp.params['pattern']));
        for (const r of rows) {
          const v = r[exp.column];
          if (typeof v !== 'string' || !pattern.test(v)) failures += 1;
        }
        detail = `패턴 불일치 ${failures}건`;
        break;
      }
      case 'categorical': {
        const allowed = new Set((exp.params['values'] as unknown[]) ?? []);
        for (const r of rows) {
          if (!allowed.has(r[exp.column])) failures += 1;
        }
        detail = `허용값 외 ${failures}건`;
        break;
      }
      case 'length': {
        const minLen = Number(exp.params['min'] ?? 0);
        const maxLen = Number(exp.params['max'] ?? Number.POSITIVE_INFINITY);
        for (const r of rows) {
          const v = r[exp.column];
          const len = typeof v === 'string' ? v.length : 0;
          if (len < minLen || len > maxLen) failures += 1;
        }
        detail = `길이 이탈 ${failures}건`;
        break;
      }
      default:
        detail = 'unknown';
    }
    return {
      expectationId: exp.id,
      passed: failures === 0,
      failureCount: failures,
      details: detail,
    };
  }

  private detectDrift(dataset: string, rows: DataRow[]): boolean {
    const numericCols = this.numericColumns(rows);
    let drift = false;
    for (const col of numericCols) {
      const values = rows
        .map((r) => Number(r[col]))
        .filter((v) => !Number.isNaN(v));
      if (values.length === 0) continue;
      const mean = values.reduce((a, b) => a + b, 0) / values.length;
      const key = `${dataset}:${col}`;
      const prev = this.historyStats.get(key);
      if (prev && prev.mean !== 0) {
        const change = Math.abs((mean - prev.mean) / prev.mean);
        if (change > 0.3) drift = true;
      }
      this.historyStats.set(key, {
        mean,
        count: (prev?.count ?? 0) + 1,
      });
    }
    return drift;
  }

  private numericColumns(rows: DataRow[]): string[] {
    const sample = rows[0];
    if (!sample) return [];
    return Object.keys(sample).filter((k) => typeof sample[k] === 'number');
  }
}
