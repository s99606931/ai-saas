// Design Ref: §도로 안전 분석 AI — 사고 기록 수집·블랙스팟 탐지
// Plan SC: FR-R533.1~6

const DATA_GRADE_BLOCK = ['C', 'S'] as const;
type DataGrade = 'C' | 'S' | 'O';

function blockClassifiedData(grade: DataGrade): void {
  if ((DATA_GRADE_BLOCK as readonly string[]).includes(grade)) {
    throw new Error(`BLOCKED: ${grade}등급 데이터는 AI API 전송 금지 (N2SF N-05)`);
  }
}

export type AccidentSeverity = 'minor' | 'serious' | 'fatal';

export interface Accident {
  accidentId: string;
  roadId: string;
  occurredAt: string;
  severity: AccidentSeverity;
  injured: number;
  fatalities: number;
  weather: 'clear' | 'rain' | 'snow' | 'fog';
}

export interface Road {
  roadId: string;
  name: string;
  lengthKm: number;
  speedLimit: number;
}

export interface BlackSpot {
  roadId: string;
  accidentCount: number;
  fatalityCount: number;
  riskScore: number;
}

interface AuditEntry {
  timestamp: string;
  action: string;
  detail: Record<string, unknown>;
}

export class RoadSafetyAnalyticsAI {
  private readonly roads = new Map<string, Road>();
  private readonly accidents: Accident[] = [];
  private readonly auditLog: AuditEntry[] = [];

  private append(action: string, detail: Record<string, unknown>): void {
    this.auditLog.push({ timestamp: new Date().toISOString(), action, detail });
  }

  // Plan SC: FR-R533.1
  registerRoad(road: Road, grade: DataGrade = 'O'): void {
    blockClassifiedData(grade);
    if (road.lengthKm <= 0) throw new Error('도로 길이는 양수여야 합니다');
    if (road.speedLimit <= 0) throw new Error('제한속도는 양수여야 합니다');
    this.roads.set(road.roadId, { ...road });
    this.append('REGISTER_ROAD', { roadId: road.roadId });
  }

  // Plan SC: FR-R533.2
  recordAccident(accident: Accident, grade: DataGrade = 'O'): void {
    blockClassifiedData(grade);
    if (!this.roads.has(accident.roadId)) throw new Error(`도로 미등록: ${accident.roadId}`);
    if (accident.injured < 0 || accident.fatalities < 0) throw new Error('부상/사망자 수는 음수일 수 없습니다');
    this.accidents.push({ ...accident });
    this.append('RECORD_ACCIDENT', { accidentId: accident.accidentId, severity: accident.severity });
  }

  // Plan SC: FR-R533.3
  detectBlackSpots(threshold = 3): BlackSpot[] {
    const grouped = new Map<string, { count: number; fatalities: number; seriousCount: number }>();
    for (const a of this.accidents) {
      const prev = grouped.get(a.roadId) ?? { count: 0, fatalities: 0, seriousCount: 0 };
      prev.count += 1;
      prev.fatalities += a.fatalities;
      if (a.severity === 'serious' || a.severity === 'fatal') prev.seriousCount += 1;
      grouped.set(a.roadId, prev);
    }

    const results: BlackSpot[] = [];
    for (const [roadId, stats] of grouped.entries()) {
      if (stats.count < threshold) continue;
      const riskScore = stats.count * 10 + stats.fatalities * 50 + stats.seriousCount * 20;
      results.push({ roadId, accidentCount: stats.count, fatalityCount: stats.fatalities, riskScore });
    }
    results.sort((a, b) => b.riskScore - a.riskScore);
    this.append('DETECT_BLACKSPOTS', { count: results.length, threshold });
    return results;
  }

  // Plan SC: FR-R533.4
  getRoadStats(roadId: string): { totalAccidents: number; fatalities: number; injured: number } {
    if (!this.roads.has(roadId)) throw new Error(`도로 미등록: ${roadId}`);
    let totalAccidents = 0;
    let fatalities = 0;
    let injured = 0;
    for (const a of this.accidents) {
      if (a.roadId !== roadId) continue;
      totalAccidents += 1;
      fatalities += a.fatalities;
      injured += a.injured;
    }
    return { totalAccidents, fatalities, injured };
  }

  // Plan SC: FR-R533.5
  listAccidents(roadId: string): Accident[] {
    return this.accidents.filter(a => a.roadId === roadId).map(a => ({ ...a }));
  }

  // Plan SC: FR-R533.6
  getAuditLog(): AuditEntry[] {
    return [...this.auditLog];
  }
}
