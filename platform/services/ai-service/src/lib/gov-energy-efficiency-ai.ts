// Design Ref: §핵심 알고리즘 — 정부 청사 에너지 효율화 점수 모델
// Plan SC: FR-R512.1~5

const DATA_GRADE_BLOCK = ['C', 'S'] as const;
type DataGrade = 'C' | 'S' | 'O';

function blockClassifiedData(grade: DataGrade): void {
  if ((DATA_GRADE_BLOCK as readonly string[]).includes(grade)) {
    throw new Error(`BLOCKED: ${grade}등급 데이터는 AI API 전송 금지 (N2SF N-05)`);
  }
}

interface EnergyReading {
  buildingId: string;
  monthYYYYMM: string;
  electricityKwh: number;
  gasNm3: number;
  heatingMcal: number;
  occupancyAvg: number;
  floorAreaM2: number;
}

interface EfficiencyScore {
  buildingId: string;
  monthYYYYMM: string;
  energyIntensityKwhPerM2: number;
  efficiencyScore: number; // 0 ~ 100, 높을수록 효율
  grade: 'A' | 'B' | 'C' | 'D' | 'E';
}

interface SavingRecommendation {
  buildingId: string;
  category: 'lighting' | 'hvac' | 'envelope' | 'behavior';
  estimatedSavingPct: number;
  description: string;
}

interface AuditEntry {
  timestamp: string;
  action: string;
  detail: Record<string, unknown>;
}

export class GovEnergyEfficiencyAI {
  private readings: EnergyReading[] = [];
  private readonly auditLog: AuditEntry[] = [];

  private appendAudit(action: string, detail: Record<string, unknown>): void {
    this.auditLog.push({ timestamp: new Date().toISOString(), action, detail });
  }

  // Plan SC: FR-R512.1
  recordReading(reading: EnergyReading, grade: DataGrade = 'O'): void {
    blockClassifiedData(grade);
    if (reading.floorAreaM2 <= 0) throw new Error('floorAreaM2 > 0 필요');
    this.readings.push(reading);
    this.appendAudit('RECORD_READING', { buildingId: reading.buildingId, monthYYYYMM: reading.monthYYYYMM });
  }

  // Plan SC: FR-R512.2
  computeEfficiency(buildingId: string, monthYYYYMM: string): EfficiencyScore {
    const r = this.readings.find(x => x.buildingId === buildingId && x.monthYYYYMM === monthYYYYMM);
    if (!r) throw new Error(`기록 없음: ${buildingId} ${monthYYYYMM}`);
    const totalKwh = r.electricityKwh + r.gasNm3 * 11.06 + r.heatingMcal * 1.163;
    const intensity = totalKwh / r.floorAreaM2;
    let score = Math.round(Math.max(0, Math.min(100, 100 - intensity * 2)));
    if (r.occupancyAvg > 0) {
      score = Math.round(score + Math.min(10, r.occupancyAvg / 100));
    }
    score = Math.max(0, Math.min(100, score));
    const grade = this.assignGrade(score);
    this.appendAudit('COMPUTE_EFFICIENCY', { buildingId, monthYYYYMM, score, grade });
    return { buildingId, monthYYYYMM, energyIntensityKwhPerM2: Math.round(intensity * 100) / 100, efficiencyScore: score, grade };
  }

  private assignGrade(score: number): 'A' | 'B' | 'C' | 'D' | 'E' {
    if (score >= 80) return 'A';
    if (score >= 65) return 'B';
    if (score >= 50) return 'C';
    if (score >= 35) return 'D';
    return 'E';
  }

  // Plan SC: FR-R512.3
  recommendSavings(buildingId: string, monthYYYYMM: string): SavingRecommendation[] {
    const score = this.computeEfficiency(buildingId, monthYYYYMM);
    const recs: SavingRecommendation[] = [];
    if (score.efficiencyScore < 80) {
      recs.push({ buildingId, category: 'lighting', estimatedSavingPct: 8, description: 'LED 교체 및 자동 점멸 도입' });
    }
    if (score.efficiencyScore < 65) {
      recs.push({ buildingId, category: 'hvac', estimatedSavingPct: 12, description: '냉난방 스케줄 최적화 및 인버터 적용' });
    }
    if (score.efficiencyScore < 50) {
      recs.push({ buildingId, category: 'envelope', estimatedSavingPct: 15, description: '단열재 보강 및 창호 교체' });
    }
    if (score.efficiencyScore < 35) {
      recs.push({ buildingId, category: 'behavior', estimatedSavingPct: 5, description: '직원 대상 절전 캠페인 및 전수 점검' });
    }
    this.appendAudit('RECOMMEND_SAVINGS', { buildingId, monthYYYYMM, count: recs.length });
    return recs;
  }

  // Plan SC: FR-R512.4
  computePortfolioAverage(monthYYYYMM: string): number {
    const monthly = this.readings.filter(r => r.monthYYYYMM === monthYYYYMM);
    if (monthly.length === 0) return 0;
    let total = 0;
    for (const r of monthly) {
      total += this.computeEfficiency(r.buildingId, monthYYYYMM).efficiencyScore;
    }
    return Math.round(total / monthly.length);
  }

  // Plan SC: FR-R512.5
  getAuditLog(): AuditEntry[] {
    return [...this.auditLog];
  }
}
