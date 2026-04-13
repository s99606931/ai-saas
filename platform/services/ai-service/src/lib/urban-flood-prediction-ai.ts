// Design Ref: §도시 침수 예측 — 강수·배수·지형 위험 합산 모델
// Plan SC: FR-R526.1~6

const DATA_GRADE_BLOCK = ['C', 'S'] as const;
type DataGrade = 'C' | 'S' | 'O';

function blockClassifiedData(grade: DataGrade): void {
  if ((DATA_GRADE_BLOCK as readonly string[]).includes(grade)) {
    throw new Error(`BLOCKED: ${grade}등급 데이터는 AI API 전송 금지 (N2SF N-05)`);
  }
}

export type FloodRiskLevel = 'safe' | 'watch' | 'warning' | 'severe' | 'catastrophic';

export interface DistrictProfile {
  districtId: string;
  name: string;
  drainageCapacityMmPerHour: number; // 시간당 배수 용량 mm
  elevationM: number; // 평균 해발 m
  impermeableAreaRatio: number; // 0~1 (불투수 면적 비율)
}

export interface RainfallObservation {
  districtId: string;
  observedAt: string;
  rainfallMmPerHour: number;
  durationHours: number;
}

export interface FloodPrediction {
  districtId: string;
  riskScore: number;
  level: FloodRiskLevel;
  exceedanceMm: number;
  evacuationAdvised: boolean;
}

interface AuditEntry {
  timestamp: string;
  action: string;
  detail: Record<string, unknown>;
}

export class UrbanFloodPredictionAI {
  private districts = new Map<string, DistrictProfile>();
  private observations = new Map<string, RainfallObservation[]>();
  private auditLog: AuditEntry[] = [];

  private append(action: string, detail: Record<string, unknown>): void {
    this.auditLog.push({ timestamp: new Date().toISOString(), action, detail });
  }

  // Plan SC: FR-R526.1
  registerDistrict(profile: DistrictProfile, grade: DataGrade = 'O'): void {
    blockClassifiedData(grade);
    if (profile.drainageCapacityMmPerHour < 0) throw new Error('배수 용량은 0 이상이어야 합니다');
    if (profile.impermeableAreaRatio < 0 || profile.impermeableAreaRatio > 1) {
      throw new Error('불투수 면적 비율은 0~1 범위여야 합니다');
    }
    this.districts.set(profile.districtId, { ...profile });
    if (!this.observations.has(profile.districtId)) this.observations.set(profile.districtId, []);
    this.append('REGISTER_DISTRICT', { districtId: profile.districtId });
  }

  // Plan SC: FR-R526.2
  recordRainfall(obs: RainfallObservation, grade: DataGrade = 'O'): void {
    blockClassifiedData(grade);
    if (!this.districts.has(obs.districtId)) throw new Error(`지역 미등록: ${obs.districtId}`);
    if (obs.rainfallMmPerHour < 0 || obs.durationHours < 0) {
      throw new Error('강수량과 지속시간은 0 이상이어야 합니다');
    }
    const list = this.observations.get(obs.districtId) ?? [];
    list.push({ ...obs });
    this.observations.set(obs.districtId, list);
    this.append('RECORD_RAINFALL', { districtId: obs.districtId, mm: obs.rainfallMmPerHour });
  }

  // Plan SC: FR-R526.3
  predict(districtId: string, grade: DataGrade = 'O'): FloodPrediction {
    blockClassifiedData(grade);
    const district = this.districts.get(districtId);
    if (!district) throw new Error(`지역 미등록: ${districtId}`);
    const obsList = this.observations.get(districtId) ?? [];
    if (obsList.length === 0) throw new Error(`강수 관측 없음: ${districtId}`);

    const latest = obsList[obsList.length - 1]!;
    const totalRainfall = latest.rainfallMmPerHour * latest.durationHours;
    const drainable = district.drainageCapacityMmPerHour * latest.durationHours;
    const exceedanceMm = Math.max(0, totalRainfall - drainable);

    let riskScore = exceedanceMm * 1.2;
    if (district.elevationM < 10) riskScore += 15;
    else if (district.elevationM < 30) riskScore += 5;

    riskScore += district.impermeableAreaRatio * 20;

    const level: FloodRiskLevel =
      riskScore >= 80
        ? 'catastrophic'
        : riskScore >= 50
          ? 'severe'
          : riskScore >= 30
            ? 'warning'
            : riskScore >= 10
              ? 'watch'
              : 'safe';

    const prediction: FloodPrediction = {
      districtId,
      riskScore: Math.round(riskScore * 100) / 100,
      level,
      exceedanceMm: Math.round(exceedanceMm * 100) / 100,
      evacuationAdvised: level === 'severe' || level === 'catastrophic',
    };
    this.append('PREDICT', { districtId, level, riskScore: prediction.riskScore });
    return prediction;
  }

  // Plan SC: FR-R526.4
  listDistricts(): DistrictProfile[] {
    return Array.from(this.districts.values()).map(d => ({ ...d }));
  }

  // Plan SC: FR-R526.5
  getObservations(districtId: string): RainfallObservation[] {
    return (this.observations.get(districtId) ?? []).map(o => ({ ...o }));
  }

  // Plan SC: FR-R526.6
  getAuditLog(): AuditEntry[] {
    return [...this.auditLog];
  }
}
