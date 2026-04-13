// Design Ref: §대중교통 접근성 지수 (거리-빈도-환승 가중 모델)
// Plan SC: FR-R616.1~5

enum DataGrade { C = 'C', S = 'S', O = 'O' }

type TransitMode = 'bus' | 'subway' | 'tram' | 'brt';

interface TransitStop {
  id: string;
  mode: TransitMode;
  frequencyPerHour: number;
  lineCount: number;
}

interface Zone {
  id: string;
  population: number;
  nearestStops: Array<{ stopId: string; walkMinutes: number }>;
}

interface AccessibilityScore {
  zoneId: string;
  score: number;
  grade: 'excellent' | 'good' | 'fair' | 'poor';
  weakPoints: string[];
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

const MODE_WEIGHT: Record<TransitMode, number> = {
  subway: 1.0,
  brt: 0.85,
  tram: 0.75,
  bus: 0.6,
};

export class PublicTransportAccessibilityAI {
  private stops = new Map<string, TransitStop>();
  private zones = new Map<string, Zone>();
  private readonly audit: AuditEntry[] = [];

  private log(action: string, detail: Record<string, unknown>): void {
    this.audit.push({ timestamp: new Date().toISOString(), action, detail });
  }

  // Plan SC: FR-R616.1
  registerStop(stop: TransitStop): void {
    if (stop.frequencyPerHour < 0) throw new Error('빈도는 음수일 수 없음');
    this.stops.set(stop.id, stop);
    this.log('REGISTER_STOP', { id: stop.id, mode: stop.mode });
  }

  // Plan SC: FR-R616.2
  registerZone(zone: Zone, grade: DataGrade = DataGrade.O): void {
    blockClassifiedData(grade);
    if (zone.population < 0) throw new Error('인구는 음수일 수 없음');
    this.zones.set(zone.id, zone);
    this.log('REGISTER_ZONE', { id: zone.id, population: zone.population });
  }

  // Plan SC: FR-R616.3
  private stopScore(stop: TransitStop, walkMinutes: number): number {
    const modeW = MODE_WEIGHT[stop.mode];
    const walkDecay = Math.max(0, 1 - walkMinutes / 20);
    const frequencyFactor = Math.min(1, stop.frequencyPerHour / 10);
    const lineFactor = Math.min(1.3, 1 + (stop.lineCount - 1) * 0.1);
    return modeW * walkDecay * frequencyFactor * lineFactor * 100;
  }

  // Plan SC: FR-R616.4
  computeScore(zoneId: string, grade: DataGrade = DataGrade.O): AccessibilityScore {
    blockClassifiedData(grade);
    const zone = this.zones.get(zoneId);
    if (!zone) throw new Error(`존 미등록: ${zoneId}`);

    const scores: number[] = [];
    const weakPoints: string[] = [];
    for (const ns of zone.nearestStops) {
      const stop = this.stops.get(ns.stopId);
      if (!stop) continue;
      const s = this.stopScore(stop, ns.walkMinutes);
      scores.push(s);
      if (ns.walkMinutes > 15) weakPoints.push(`${ns.stopId} 도보 15분 초과`);
      if (stop.frequencyPerHour < 4) weakPoints.push(`${ns.stopId} 배차 부족`);
    }

    const raw = scores.length === 0 ? 0 : Math.max(...scores);
    const score = Math.round(raw * 10) / 10;
    const gradeLabel: AccessibilityScore['grade'] = score >= 80 ? 'excellent'
      : score >= 60 ? 'good'
      : score >= 40 ? 'fair' : 'poor';

    const result: AccessibilityScore = { zoneId, score, grade: gradeLabel, weakPoints };
    this.log('COMPUTE_SCORE', { zoneId, score, grade: gradeLabel });
    return result;
  }

  // Plan SC: FR-R616.5
  rankZones(grade: DataGrade = DataGrade.O): Array<{ zoneId: string; score: number }> {
    blockClassifiedData(grade);
    const results: Array<{ zoneId: string; score: number }> = [];
    for (const zone of this.zones.values()) {
      const s = this.computeScore(zone.id, grade);
      results.push({ zoneId: zone.id, score: s.score });
    }
    results.sort((a, b) => b.score - a.score);
    this.log('RANK_ZONES', { count: results.length });
    return results;
  }

  getAuditLog(): readonly AuditEntry[] {
    return this.audit;
  }
}
