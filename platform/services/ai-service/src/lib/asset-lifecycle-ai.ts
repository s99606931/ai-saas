// Design Ref: MTU-N440 §자산 생애주기 AI
// Plan SC: FR-N440.1~5

export type DepreciationMethod = 'straight-line' | 'declining-balance';
export type AssetCategory = 'computer' | 'vehicle' | 'furniture' | 'facility' | 'other';

export interface Asset {
  assetId: string;
  name: string;
  category: AssetCategory;
  acquisitionDate: string;
  acquisitionCostKrw: number;
  usefulLifeYears: number;
  method: DepreciationMethod;
  actualUsageRate: number;
}

export interface DepreciationResult {
  assetId: string;
  yearsElapsed: number;
  accumulatedDepreciation: number;
  currentBookValue: number;
}

export interface ReplacementRecommendation {
  assetId: string;
  recommend: boolean;
  reason: string;
  suggestedYear: number;
}

export interface BudgetEstimate {
  totalReplacementsNext3Years: number;
  totalBudgetKrw: number;
  byCategory: Record<AssetCategory, number>;
}

export class AssetLifecycleAi {
  /** FR-N440.1 자산 등록 */
  registerAssets(raw: Asset[]): Asset[] {
    return raw.filter((a) => a.acquisitionCostKrw > 0 && a.usefulLifeYears > 0);
  }

  /** FR-N440.2 감가상각 계산 */
  computeDepreciation(asset: Asset, today: string): DepreciationResult {
    const acquired = new Date(asset.acquisitionDate).getTime();
    const now = new Date(today).getTime();
    const yearsElapsed = Math.max(0, (now - acquired) / (1000 * 60 * 60 * 24 * 365));

    let accumulated = 0;
    if (asset.method === 'straight-line') {
      const annualRate = asset.acquisitionCostKrw / asset.usefulLifeYears;
      accumulated = Math.min(asset.acquisitionCostKrw, annualRate * yearsElapsed);
    } else {
      const rate = 1 - Math.pow(0.1, 1 / asset.usefulLifeYears);
      let book = asset.acquisitionCostKrw;
      const fullYears = Math.floor(yearsElapsed);
      for (let i = 0; i < fullYears; i++) book *= 1 - rate;
      accumulated = asset.acquisitionCostKrw - book;
    }
    return {
      assetId: asset.assetId,
      yearsElapsed: +yearsElapsed.toFixed(2),
      accumulatedDepreciation: +accumulated.toFixed(2),
      currentBookValue: +(asset.acquisitionCostKrw - accumulated).toFixed(2),
    };
  }

  /** FR-N440.3 잔존가치 예측 */
  forecastResidualValue(asset: Asset, atYear: number): number {
    const annualRate = asset.acquisitionCostKrw / asset.usefulLifeYears;
    return +Math.max(0, asset.acquisitionCostKrw - annualRate * atYear).toFixed(2);
  }

  /** FR-N440.4 교체 시점 추천 */
  recommendReplacement(asset: Asset, today: string): ReplacementRecommendation {
    const dep = this.computeDepreciation(asset, today);
    const nominalEnd = asset.usefulLifeYears;
    const usageAdjusted = nominalEnd / Math.max(0.5, asset.actualUsageRate);
    const suggestedYear = Math.round(usageAdjusted);

    if (dep.yearsElapsed >= usageAdjusted) {
      return {
        assetId: asset.assetId,
        recommend: true,
        reason: `사용률 보정 내용연수(${suggestedYear}년) 초과`,
        suggestedYear,
      };
    }
    if (dep.currentBookValue < asset.acquisitionCostKrw * 0.1) {
      return {
        assetId: asset.assetId,
        recommend: true,
        reason: '잔존가치 10% 미만',
        suggestedYear,
      };
    }
    return {
      assetId: asset.assetId,
      recommend: false,
      reason: '정상 운용 중',
      suggestedYear,
    };
  }

  /** FR-N440.5 예산 편성 리포트 */
  estimateBudget(assets: Asset[], today: string): BudgetEstimate {
    const byCategory: Record<AssetCategory, number> = {
      computer: 0,
      vehicle: 0,
      furniture: 0,
      facility: 0,
      other: 0,
    };
    let count = 0;
    let total = 0;
    for (const a of assets) {
      const rec = this.recommendReplacement(a, today);
      if (rec.recommend) {
        count++;
        total += a.acquisitionCostKrw;
        byCategory[a.category] += a.acquisitionCostKrw;
      }
    }
    return {
      totalReplacementsNext3Years: count,
      totalBudgetKrw: +total.toFixed(2),
      byCategory,
    };
  }
}

export const assetLifecycleAi = new AssetLifecycleAi();
