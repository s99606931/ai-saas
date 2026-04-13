// SVC-AI-ADV-R496 AI Population Trend Analyzer
// Design Ref: SVC-AI-ADV-R496.design.md §인구트렌드
// Plan SC: FR-496.1~6
// CSAP D-06 / N2SF N-05

export type DataGrade = 'O' | 'C' | 'S';

const DATA_GRADE_BLOCK = ['C', 'S'] as const;

function blockClassifiedData(grade: DataGrade): void {
  if ((DATA_GRADE_BLOCK as readonly string[]).includes(grade)) {
    throw new Error(`BLOCKED: ${grade}등급 데이터는 AI API 전송 금지 (N2SF N-05)`);
  }
}

export interface PopulationSnapshot {
  readonly regionCode: string;
  readonly year: number;
  readonly totalPopulation: number;
  readonly under15: number;
  readonly age15to64: number;
  readonly over65: number;
  readonly births: number;
  readonly deaths: number;
  readonly inMigration: number;
  readonly outMigration: number;
}

export interface TrendAnalysis {
  readonly regionCode: string;
  readonly currentYear: number;
  readonly agingIndex: number;
  readonly dependencyRatio: number;
  readonly naturalIncrease: number;
  readonly netMigration: number;
  readonly populationCategory: 'growing' | 'stable' | 'declining' | 'depopulating';
  readonly forecastNextYear: number;
}

interface AuditEntry {
  readonly timestamp: string;
  readonly action: string;
  readonly detail: Record<string, unknown>;
}

export class AiPopulationTrendAnalyzer {
  private readonly auditLog: AuditEntry[] = [];
  private readonly snapshots: Map<string, PopulationSnapshot[]> = new Map();

  ingest(snapshot: PopulationSnapshot, grade: DataGrade = 'O'): void {
    blockClassifiedData(grade);
    if (snapshot.totalPopulation < 0) {
      throw new Error('VALIDATION: 음수 인구 불가');
    }
    const arr = this.snapshots.get(snapshot.regionCode) ?? [];
    arr.push(snapshot);
    arr.sort((a, b) => a.year - b.year);
    this.snapshots.set(snapshot.regionCode, arr);
    this.appendAudit('INGEST', { regionCode: snapshot.regionCode, year: snapshot.year });
  }

  analyze(regionCode: string): TrendAnalysis {
    const arr = this.snapshots.get(regionCode);
    if (!arr || arr.length === 0) {
      throw new Error(`NOT_FOUND: ${regionCode}`);
    }
    const last = arr[arr.length - 1]!;

    const agingIndex = last.under15 === 0 ? 0 : (last.over65 / last.under15) * 100;
    const dependencyRatio =
      last.age15to64 === 0
        ? 0
        : ((last.under15 + last.over65) / last.age15to64) * 100;
    const naturalIncrease = last.births - last.deaths;
    const netMigration = last.inMigration - last.outMigration;

    let category: TrendAnalysis['populationCategory'] = 'stable';
    if (arr.length >= 2) {
      const prev = arr[arr.length - 2]!;
      const change = (last.totalPopulation - prev.totalPopulation) / prev.totalPopulation;
      if (change > 0.01) category = 'growing';
      else if (change < -0.05) category = 'depopulating';
      else if (change < -0.005) category = 'declining';
    }

    const forecastNextYear = Math.max(0, last.totalPopulation + naturalIncrease + netMigration);

    const result: TrendAnalysis = {
      regionCode,
      currentYear: last.year,
      agingIndex: Math.round(agingIndex * 100) / 100,
      dependencyRatio: Math.round(dependencyRatio * 100) / 100,
      naturalIncrease,
      netMigration,
      populationCategory: category,
      forecastNextYear,
    };

    this.appendAudit('ANALYZE', {
      regionCode,
      category,
      forecastNextYear,
    });
    return result;
  }

  totalRegions(): number {
    return this.snapshots.size;
  }

  getAuditLog(): readonly AuditEntry[] {
    return [...this.auditLog];
  }

  private appendAudit(action: string, detail: Record<string, unknown>): void {
    this.auditLog.push({
      timestamp: new Date().toISOString(),
      action,
      detail,
    });
  }
}
