// Design Ref: §홍수 피해 추정 (수심-피해 함수)
// Plan SC: FR-R615.1~5

enum DataGrade { C = 'C', S = 'S', O = 'O' }

type AssetType = 'residential' | 'commercial' | 'industrial' | 'infrastructure' | 'agricultural';

interface Asset {
  id: string;
  type: AssetType;
  valueKRW: number;
  locationElevation: number;
}

interface FloodScenario {
  id: string;
  regionId: string;
  waterDepthM: number;
  durationHours: number;
  forecastAt: string;
}

interface DamageEstimate {
  scenarioId: string;
  assetId: string;
  damageRatio: number;
  estimatedLossKRW: number;
  severity: 'minor' | 'moderate' | 'severe' | 'catastrophic';
}

interface AuditEntry {
  timestamp: string;
  action: string;
  detail: Record<string, unknown>;
}

function blockClassifiedData(grade: DataGrade): void {
  if (grade === DataGrade.C || grade === DataGrade.S) {
    throw new Error(`BLOCKED: ${grade}등급 데이터는 AI API 전송 금지 (N2SF N-05)`);
  }
}

// 수심(m) → 피해 비율 보정 계수 (자산 유형별)
const VULNERABILITY: Record<AssetType, number> = {
  residential: 1.0,
  commercial: 0.9,
  industrial: 0.85,
  infrastructure: 0.7,
  agricultural: 1.2,
};

export class AIFloodDamageEstimator {
  private assets = new Map<string, Asset>();
  private scenarios = new Map<string, FloodScenario>();
  private readonly audit: AuditEntry[] = [];

  private log(action: string, detail: Record<string, unknown>): void {
    this.audit.push({ timestamp: new Date().toISOString(), action, detail });
  }

  // Plan SC: FR-R615.1
  registerAsset(asset: Asset): void {
    if (asset.valueKRW < 0) throw new Error('가치는 음수일 수 없음');
    this.assets.set(asset.id, asset);
    this.log('REGISTER_ASSET', { id: asset.id, type: asset.type });
  }

  // Plan SC: FR-R615.2
  registerScenario(scenario: FloodScenario, grade: DataGrade = DataGrade.O): void {
    blockClassifiedData(grade);
    if (scenario.waterDepthM < 0) throw new Error('수심은 음수일 수 없음');
    this.scenarios.set(scenario.id, scenario);
    this.log('REGISTER_SCENARIO', { id: scenario.id, depth: scenario.waterDepthM });
  }

  // Plan SC: FR-R615.3
  private computeDamageRatio(asset: Asset, scenario: FloodScenario): number {
    const effectiveDepth = Math.max(0, scenario.waterDepthM - asset.locationElevation);
    if (effectiveDepth === 0) return 0;
    // 수심-피해 로그 함수
    const baseRatio = Math.min(1, Math.log(1 + effectiveDepth) / Math.log(5));
    const durationFactor = Math.min(1.5, 1 + scenario.durationHours / 100);
    const vuln = VULNERABILITY[asset.type];
    return Math.min(1, baseRatio * vuln * durationFactor);
  }

  private severityFromRatio(ratio: number): DamageEstimate['severity'] {
    if (ratio < 0.2) return 'minor';
    if (ratio < 0.5) return 'moderate';
    if (ratio < 0.8) return 'severe';
    return 'catastrophic';
  }

  // Plan SC: FR-R615.4
  estimate(scenarioId: string, assetId: string, grade: DataGrade = DataGrade.O): DamageEstimate {
    blockClassifiedData(grade);
    const scenario = this.scenarios.get(scenarioId);
    const asset = this.assets.get(assetId);
    if (!scenario) throw new Error(`시나리오 미등록: ${scenarioId}`);
    if (!asset) throw new Error(`자산 미등록: ${assetId}`);

    const damageRatio = this.computeDamageRatio(asset, scenario);
    const estimate: DamageEstimate = {
      scenarioId,
      assetId,
      damageRatio: Math.round(damageRatio * 1000) / 1000,
      estimatedLossKRW: Math.round(asset.valueKRW * damageRatio),
      severity: this.severityFromRatio(damageRatio),
    };
    this.log('ESTIMATE', { scenarioId, assetId, severity: estimate.severity });
    return estimate;
  }

  // Plan SC: FR-R615.5
  estimateRegionTotal(scenarioId: string, grade: DataGrade = DataGrade.O): number {
    blockClassifiedData(grade);
    if (!this.scenarios.has(scenarioId)) {
      throw new Error(`시나리오 미등록: ${scenarioId}`);
    }
    let total = 0;
    for (const asset of this.assets.values()) {
      const est = this.estimate(scenarioId, asset.id, grade);
      total += est.estimatedLossKRW;
    }
    this.log('ESTIMATE_REGION_TOTAL', { scenarioId, total });
    return total;
  }

  getAuditLog(): readonly AuditEntry[] {
    return this.audit;
  }
}
