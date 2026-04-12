/**
 * BI/Analytics 파사드 (MTU-N471~N474)
 * Design Ref: MTU-N471~N474
 * Plan SC: FR-BI.*, FR-PA.*, FR-T2A.*, FR-STAT.*
 */

// ============ MTU-N471: KPI 대시보드 ============

export interface KpiDefinition {
  kpiId: string;
  name: string;
  unit: string;
  target?: number;
  warningThreshold?: number;
  criticalThreshold?: number;
}

export interface KpiSnapshot {
  kpiId: string;
  value: number;
  timestamp: string;
}

export class KpiRegistry {
  private defs = new Map<string, KpiDefinition>();
  private snapshots: KpiSnapshot[] = [];

  register(def: KpiDefinition): void {
    this.defs.set(def.kpiId, def);
  }

  record(snapshot: KpiSnapshot): void {
    if (!this.defs.has(snapshot.kpiId)) {
      throw new Error(`미정의 KPI: ${snapshot.kpiId}`);
    }
    this.snapshots.push({ ...snapshot });
  }

  latest(kpiId: string): KpiSnapshot | undefined {
    const list = this.snapshots.filter((s) => s.kpiId === kpiId);
    return list[list.length - 1];
  }

  /**
   * 알림 임계값 체크 (FR-BI.5)
   */
  evaluateAlert(snapshot: KpiSnapshot): 'ok' | 'warning' | 'critical' {
    const def = this.defs.get(snapshot.kpiId);
    if (!def) return 'ok';
    if (def.criticalThreshold !== undefined && snapshot.value >= def.criticalThreshold) {
      return 'critical';
    }
    if (def.warningThreshold !== undefined && snapshot.value >= def.warningThreshold) {
      return 'warning';
    }
    return 'ok';
  }

  list(): KpiDefinition[] {
    return Array.from(this.defs.values());
  }
}

// ============ MTU-N472: 예측 분석 ============

export interface TimeSeriesPoint {
  timestamp: string;
  value: number;
}

export class TimeSeriesAnalyzer {
  /**
   * 분해: trend, seasonal, residual (단순화)
   */
  decompose(series: TimeSeriesPoint[], window = 7): {
    trend: number[];
    seasonal: number[];
    residual: number[];
  } {
    const values = series.map((p) => p.value);
    const trend = this.movingAverage(values, window);
    const seasonal = values.map((v, i) => v - (trend[i] ?? v));
    const residual = values.map((v, i) => v - (trend[i] ?? 0) - (seasonal[i] ?? 0));
    return { trend, seasonal, residual };
  }

  private movingAverage(values: number[], window: number): number[] {
    const result: number[] = [];
    for (let i = 0; i < values.length; i++) {
      const start = Math.max(0, i - Math.floor(window / 2));
      const end = Math.min(values.length, i + Math.floor(window / 2) + 1);
      const slice = values.slice(start, end);
      const avg = slice.reduce((s, v) => s + v, 0) / slice.length;
      result.push(avg);
    }
    return result;
  }

  /**
   * 단순 예측 (이동평균 + 선형 추세)
   */
  forecast(series: TimeSeriesPoint[], steps: number): number[] {
    if (series.length < 2) return [];
    const values = series.map((p) => p.value);
    const first = values[0] ?? 0;
    const last = values[values.length - 1] ?? 0;
    const slope = (last - first) / values.length;
    const result: number[] = [];
    for (let i = 1; i <= steps; i++) {
      result.push(last + slope * i);
    }
    return result;
  }

  /**
   * MAPE 계산
   */
  mape(actual: number[], predicted: number[]): number {
    if (actual.length === 0) return 0;
    const len = Math.min(actual.length, predicted.length);
    let sum = 0;
    let count = 0;
    for (let i = 0; i < len; i++) {
      const a = actual[i] ?? 0;
      const p = predicted[i] ?? 0;
      if (a !== 0) {
        sum += Math.abs((a - p) / a);
        count++;
      }
    }
    return count > 0 ? (sum / count) * 100 : 0;
  }
}

// ============ MTU-N473: Text-to-Analysis ============

export interface NlQuery {
  text: string;
  tableHint?: string;
}

/**
 * 자연어 → 안전한 SQL 생성기 (PII 마스킹 포함)
 * 규칙 기반 단순 구현 (LLM 제외)
 */
export class TextToSqlConverter {
  private schemas = new Map<string, string[]>();
  private piiFields = new Set<string>();

  registerSchema(table: string, columns: string[], piiColumns: string[] = []): void {
    this.schemas.set(table, columns);
    piiColumns.forEach((c) => this.piiFields.add(`${table}.${c}`));
  }

  /**
   * 안전한 SQL 변환 (매개변수화 쿼리)
   * CSAP D-12: SQL 주입 방지
   */
  convert(query: NlQuery): {
    sql: string;
    params: unknown[];
    piiMasked: string[];
  } {
    const table = query.tableHint ?? this.inferTable(query.text);
    if (!table || !this.schemas.has(table)) {
      throw new Error(`테이블 추론 실패: ${query.text}`);
    }
    const columns = this.schemas.get(table) ?? [];

    const lowered = query.text.toLowerCase();
    const isCount = /몇|count|개수|수/.test(lowered);
    const isSum = /합계|sum|총/.test(lowered);
    const isAvg = /평균|avg|mean/.test(lowered);

    const selectableCols = columns.filter((c) => !this.piiFields.has(`${table}.${c}`));
    const piiMasked = columns.filter((c) => this.piiFields.has(`${table}.${c}`));

    let sql: string;
    if (isCount) sql = `SELECT COUNT(*) FROM ${table} WHERE deleted_at IS NULL`;
    else if (isSum && selectableCols.length > 0) {
      sql = `SELECT SUM(${selectableCols[0]}) FROM ${table} WHERE deleted_at IS NULL`;
    } else if (isAvg && selectableCols.length > 0) {
      sql = `SELECT AVG(${selectableCols[0]}) FROM ${table} WHERE deleted_at IS NULL`;
    } else {
      sql = `SELECT ${selectableCols.join(', ')} FROM ${table} WHERE deleted_at IS NULL LIMIT 100`;
    }

    return { sql, params: [], piiMasked };
  }

  private inferTable(text: string): string | null {
    for (const table of this.schemas.keys()) {
      if (text.includes(table)) return table;
    }
    return Array.from(this.schemas.keys())[0] ?? null;
  }
}

// ============ MTU-N474: 통계 자동 산출 ============

export interface StatisticItem {
  code: string;
  name: string;
  value: number;
  unit: string;
  period: string;
}

export class PublicStatisticsBuilder {
  private items: StatisticItem[] = [];

  add(item: StatisticItem): void {
    this.items.push({ ...item });
  }

  /**
   * 이상값 탐지 (IQR 방법)
   */
  detectOutliers(code: string): StatisticItem[] {
    const series = this.items
      .filter((i) => i.code === code)
      .map((i) => i.value)
      .sort((a, b) => a - b);
    if (series.length < 4) return [];
    const q1 = series[Math.floor(series.length / 4)] ?? 0;
    const q3 = series[Math.floor((series.length * 3) / 4)] ?? 0;
    const iqr = q3 - q1;
    const lower = q1 - 1.5 * iqr;
    const upper = q3 + 1.5 * iqr;
    return this.items.filter((i) => i.code === code && (i.value < lower || i.value > upper));
  }

  /**
   * KOSIS 호환 포맷 (FR-STAT.5)
   */
  toKosisFormat(): Array<{
    PRD_DE: string;
    TBL_NM: string;
    DT: string;
    UNIT_NM: string;
  }> {
    return this.items.map((i) => ({
      PRD_DE: i.period.replace(/-/g, ''),
      TBL_NM: i.name,
      DT: String(i.value),
      UNIT_NM: i.unit,
    }));
  }
}
