// Design Ref: §선거 투표율 예측 AI
// Plan SC: FR-R623.1~5

enum DataGrade { C = 'C', S = 'S', O = 'O' }

type ElectionType = 'presidential' | 'general' | 'local' | 'byelection';
type Weather = 'sunny' | 'cloudy' | 'rainy' | 'snowy';

interface DistrictFeatures {
  districtId: string;
  electionType: ElectionType;
  registeredVoters: number;
  historicalAvgTurnout: number; // 0~1
  under30Ratio: number;
  over60Ratio: number;
  weather: Weather;
  isHoliday: boolean;
}

interface TurnoutPrediction {
  districtId: string;
  predictedTurnout: number;
  predictedVoters: number;
  confidence: number;
  contributingFactors: string[];
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

const ELECTION_BASE: Record<ElectionType, number> = {
  presidential: 0.77,
  general: 0.66,
  local: 0.58,
  byelection: 0.42,
};

const WEATHER_ADJUST: Record<Weather, number> = {
  sunny: 0.02,
  cloudy: 0.00,
  rainy: -0.04,
  snowy: -0.07,
};

export class ElectionTurnoutPredictorAI {
  private predictions = new Map<string, TurnoutPrediction>();
  private readonly audit: AuditEntry[] = [];

  private log(action: string, detail: Record<string, unknown>): void {
    this.audit.push({ timestamp: new Date().toISOString(), action, detail });
  }

  // Plan SC: FR-R623.1
  validateFeatures(f: DistrictFeatures, grade: DataGrade = DataGrade.O): void {
    blockClassifiedData(grade);
    if (f.registeredVoters <= 0) throw new Error('유권자 수 > 0 필요');
    if (f.historicalAvgTurnout < 0 || f.historicalAvgTurnout > 1) throw new Error('과거 투표율 0~1');
    if (f.under30Ratio + f.over60Ratio > 1.01) throw new Error('인구 비율 합계 오류');
    this.log('VALIDATE_FEATURES', { districtId: f.districtId });
  }

  // Plan SC: FR-R623.2
  private ageAdjustment(under30: number, over60: number): number {
    // 30세 미만 많을수록 투표율 ↓, 60세 이상 많을수록 ↑
    return +(over60 * 0.1 - under30 * 0.08).toFixed(3);
  }

  // Plan SC: FR-R623.3
  private computeFactors(f: DistrictFeatures, base: number, weatherAdj: number, ageAdj: number): string[] {
    const factors: string[] = [];
    factors.push(`기준율(${f.electionType}): ${base.toFixed(2)}`);
    factors.push(`과거투표율 보정: ${((f.historicalAvgTurnout - base) * 0.3).toFixed(3)}`);
    if (weatherAdj !== 0) factors.push(`날씨(${f.weather}) 보정: ${weatherAdj.toFixed(3)}`);
    if (ageAdj !== 0) factors.push(`연령구조 보정: ${ageAdj.toFixed(3)}`);
    if (f.isHoliday) factors.push('공휴일 효과: +0.02');
    return factors;
  }

  // Plan SC: FR-R623.4
  predict(f: DistrictFeatures, grade: DataGrade = DataGrade.O): TurnoutPrediction {
    blockClassifiedData(grade);
    this.validateFeatures(f, grade);
    const base = ELECTION_BASE[f.electionType];
    const histAdj = (f.historicalAvgTurnout - base) * 0.3;
    const weatherAdj = WEATHER_ADJUST[f.weather];
    const ageAdj = this.ageAdjustment(f.under30Ratio, f.over60Ratio);
    const holidayAdj = f.isHoliday ? 0.02 : 0;

    let turnout = base + histAdj + weatherAdj + ageAdj + holidayAdj;
    turnout = Math.max(0.1, Math.min(0.95, turnout));

    const factors = this.computeFactors(f, base, weatherAdj, ageAdj);
    const confidence = +(0.6 + Math.min(0.35, Math.abs(histAdj) * 5 + 0.15)).toFixed(2);

    const prediction: TurnoutPrediction = {
      districtId: f.districtId,
      predictedTurnout: +turnout.toFixed(3),
      predictedVoters: Math.round(f.registeredVoters * turnout),
      confidence,
      contributingFactors: factors,
    };
    this.predictions.set(f.districtId, prediction);
    this.log('PREDICT', { districtId: f.districtId, turnout: prediction.predictedTurnout });
    return prediction;
  }

  // Plan SC: FR-R623.5
  getPrediction(districtId: string): TurnoutPrediction | undefined {
    return this.predictions.get(districtId);
  }

  getAuditLog(): readonly AuditEntry[] {
    return this.audit;
  }
}
