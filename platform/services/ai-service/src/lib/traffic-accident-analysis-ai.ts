// Design Ref: §교통사고 분석 — 다요인 가중치 기반 위험 분류
// Plan SC: FR-R571.1~6

const DATA_GRADE_BLOCK = ['C', 'S'] as const;
type DataGrade = 'C' | 'S' | 'O';

function blockClassifiedData(grade: DataGrade): void {
  if ((DATA_GRADE_BLOCK as readonly string[]).includes(grade)) {
    throw new Error(`BLOCKED: ${grade}등급 데이터는 AI API 전송 금지 (N2SF N-05)`);
  }
}

export type Severity = 'minor' | 'moderate' | 'severe' | 'fatal';
export type Weather = 'clear' | 'rain' | 'snow' | 'fog';
export type RoadType = 'urban' | 'highway' | 'intersection' | 'school_zone';

export interface AccidentRecord {
  recordId: string;
  locationCode: string;
  roadType: RoadType;
  weather: Weather;
  vehicleCount: number;
  injuredCount: number;
  fatalityCount: number;
  nightTime: boolean;
  timestamp: string;
}

export interface RiskAssessment {
  recordId: string;
  severity: Severity;
  riskScore: number;
  contributingFactors: string[];
}

export interface LocationStat {
  locationCode: string;
  totalAccidents: number;
  totalInjured: number;
  totalFatalities: number;
  averageRiskScore: number;
}

interface AuditEntry {
  timestamp: string;
  action: string;
  detail: Record<string, unknown>;
}

export class TrafficAccidentAnalysisAI {
  private records = new Map<string, AccidentRecord>();
  private auditLog: AuditEntry[] = [];

  private append(action: string, detail: Record<string, unknown>): void {
    this.auditLog.push({ timestamp: new Date().toISOString(), action, detail });
  }

  // Plan SC: FR-R571.1
  recordAccident(record: AccidentRecord, grade: DataGrade = 'O'): void {
    blockClassifiedData(grade);
    if (record.vehicleCount < 1) throw new Error('차량 수는 1 이상이어야 합니다');
    if (record.injuredCount < 0 || record.fatalityCount < 0) {
      throw new Error('부상자/사망자 수는 0 이상이어야 합니다');
    }
    this.records.set(record.recordId, { ...record });
    this.append('RECORD_ACCIDENT', { recordId: record.recordId, locationCode: record.locationCode });
  }

  // Plan SC: FR-R571.2
  assessRisk(recordId: string, grade: DataGrade = 'O'): RiskAssessment {
    blockClassifiedData(grade);
    const rec = this.records.get(recordId);
    if (!rec) throw new Error(`사고 기록 미등록: ${recordId}`);

    const factors: string[] = [];
    let score = 0;

    if (rec.fatalityCount > 0) {
      score += 60 + rec.fatalityCount * 10;
      factors.push(`사망자 ${rec.fatalityCount}명`);
    }
    if (rec.injuredCount >= 3) {
      score += 25;
      factors.push('다수 부상자');
    } else if (rec.injuredCount > 0) {
      score += 10;
      factors.push('부상자 발생');
    }
    if (rec.weather === 'snow' || rec.weather === 'fog') {
      score += 15;
      factors.push(`악천후(${rec.weather})`);
    } else if (rec.weather === 'rain') {
      score += 8;
      factors.push('우천');
    }
    if (rec.roadType === 'school_zone') {
      score += 20;
      factors.push('스쿨존');
    } else if (rec.roadType === 'highway') {
      score += 12;
      factors.push('고속도로');
    }
    if (rec.nightTime) {
      score += 10;
      factors.push('야간');
    }
    if (rec.vehicleCount >= 3) {
      score += 12;
      factors.push('다중 차량');
    }

    let severity: Severity;
    if (rec.fatalityCount > 0) severity = 'fatal';
    else if (score >= 50) severity = 'severe';
    else if (score >= 25) severity = 'moderate';
    else severity = 'minor';

    this.append('ASSESS_RISK', { recordId, severity, score });
    return { recordId, severity, riskScore: score, contributingFactors: factors };
  }

  // Plan SC: FR-R571.3
  getLocationStats(locationCode: string): LocationStat {
    const items = Array.from(this.records.values()).filter(r => r.locationCode === locationCode);
    if (items.length === 0) {
      return {
        locationCode,
        totalAccidents: 0,
        totalInjured: 0,
        totalFatalities: 0,
        averageRiskScore: 0,
      };
    }
    const totalInjured = items.reduce((s, r) => s + r.injuredCount, 0);
    const totalFatalities = items.reduce((s, r) => s + r.fatalityCount, 0);
    const scores = items.map(r => this.assessRisk(r.recordId).riskScore);
    const avg = scores.reduce((s, v) => s + v, 0) / scores.length;
    return {
      locationCode,
      totalAccidents: items.length,
      totalInjured,
      totalFatalities,
      averageRiskScore: Math.round(avg * 100) / 100,
    };
  }

  // Plan SC: FR-R571.4
  identifyHotspots(threshold = 40): LocationStat[] {
    const codes = new Set<string>();
    for (const r of this.records.values()) codes.add(r.locationCode);
    const results: LocationStat[] = [];
    for (const code of codes) {
      const stat = this.getLocationStats(code);
      if (stat.averageRiskScore >= threshold) results.push(stat);
    }
    results.sort((a, b) => b.averageRiskScore - a.averageRiskScore);
    this.append('IDENTIFY_HOTSPOTS', { count: results.length, threshold });
    return results;
  }

  // Plan SC: FR-R571.5
  listRecords(locationCode?: string): AccidentRecord[] {
    const all = Array.from(this.records.values());
    return (locationCode ? all.filter(r => r.locationCode === locationCode) : all).map(r => ({ ...r }));
  }

  // Plan SC: FR-R571.6
  getAuditLog(): AuditEntry[] {
    return [...this.auditLog];
  }
}
