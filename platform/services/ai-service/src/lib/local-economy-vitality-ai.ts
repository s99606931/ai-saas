// Design Ref: §지역 경제 활력 — 고용/매출/인구 복합 지표
// Plan SC: FR-R608.1~6

const DATA_GRADE_BLOCK = ['C', 'S'] as const;
type DataGrade = 'C' | 'S' | 'O';

function blockClassifiedData(grade: DataGrade): void {
  if ((DATA_GRADE_BLOCK as readonly string[]).includes(grade)) {
    throw new Error(`BLOCKED: ${grade}등급 데이터는 AI API 전송 금지 (N2SF N-05)`);
  }
}

export interface RegionIndicator {
  regionId: string;
  name: string;
  employmentRate: number; // 0~100
  smallBusinessRevenueIndex: number; // 기준 100
  populationNetChange: number; // 절대값
  consumerSentimentIndex: number; // 0~200 (100이 중립)
}

export interface VitalityResult {
  regionId: string;
  vitalityScore: number;
  rank: 'vibrant' | 'stable' | 'declining' | 'critical';
  drivers: string[];
}

interface AuditEntry {
  timestamp: string;
  action: string;
  detail: Record<string, unknown>;
}

export class LocalEconomyVitalityAI {
  private regions = new Map<string, RegionIndicator>();
  private auditLog: AuditEntry[] = [];

  private append(action: string, detail: Record<string, unknown>): void {
    this.auditLog.push({ timestamp: new Date().toISOString(), action, detail });
  }

  // Plan SC: FR-R608.1
  registerRegion(indicator: RegionIndicator, grade: DataGrade = 'O'): void {
    blockClassifiedData(grade);
    if (indicator.employmentRate < 0 || indicator.employmentRate > 100) {
      throw new Error('고용률은 0~100 범위여야 합니다');
    }
    if (indicator.smallBusinessRevenueIndex < 0) {
      throw new Error('매출 지수는 0 이상이어야 합니다');
    }
    if (indicator.consumerSentimentIndex < 0 || indicator.consumerSentimentIndex > 200) {
      throw new Error('소비자 심리 지수는 0~200 범위여야 합니다');
    }
    this.regions.set(indicator.regionId, { ...indicator });
    this.append('REGISTER_REGION', { regionId: indicator.regionId });
  }

  // Plan SC: FR-R608.2
  evaluate(regionId: string, grade: DataGrade = 'O'): VitalityResult {
    blockClassifiedData(grade);
    const r = this.regions.get(regionId);
    if (!r) throw new Error(`지역 미등록: ${regionId}`);

    const employmentComponent = (r.employmentRate / 100) * 30;
    const revenueComponent = Math.min(r.smallBusinessRevenueIndex / 100, 2) * 25;
    const populationComponent =
      r.populationNetChange >= 0
        ? Math.min(r.populationNetChange / 1000, 1) * 20
        : Math.max(r.populationNetChange / 1000, -1) * 20;
    const sentimentComponent = ((r.consumerSentimentIndex - 100) / 100) * 15 + 15;

    const vitalityScore = Math.round((employmentComponent + revenueComponent + populationComponent + sentimentComponent) * 100) / 100;

    const rank: VitalityResult['rank'] =
      vitalityScore >= 75 ? 'vibrant' : vitalityScore >= 55 ? 'stable' : vitalityScore >= 35 ? 'declining' : 'critical';

    const drivers: Array<[string, number]> = [
      ['고용률', employmentComponent],
      ['소상공인 매출', revenueComponent],
      ['인구 변화', populationComponent],
      ['소비자 심리', sentimentComponent],
    ];
    drivers.sort((a, b) => b[1] - a[1]);
    const topDrivers = drivers.slice(0, 2).map(d => d[0]);

    this.append('EVALUATE', { regionId, vitalityScore, rank });
    return { regionId, vitalityScore, rank, drivers: topDrivers };
  }

  // Plan SC: FR-R608.3
  ranking(): VitalityResult[] {
    const results: VitalityResult[] = [];
    for (const id of this.regions.keys()) results.push(this.evaluate(id));
    results.sort((a, b) => b.vitalityScore - a.vitalityScore);
    return results;
  }

  // Plan SC: FR-R608.4
  criticalRegions(): RegionIndicator[] {
    return this.ranking()
      .filter(r => r.rank === 'critical')
      .map(r => ({ ...this.regions.get(r.regionId)! }));
  }

  // Plan SC: FR-R608.5
  countRegions(): number {
    return this.regions.size;
  }

  // Plan SC: FR-R608.6
  getAuditLog(): AuditEntry[] {
    return [...this.auditLog];
  }
}
