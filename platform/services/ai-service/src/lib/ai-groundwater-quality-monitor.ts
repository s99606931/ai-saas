// Design Ref: §AI 지하수 수질 모니터링 — 관측공 측정값 이상 탐지
// Plan SC: FR-R586.1~6

const DATA_GRADE_BLOCK = ['C', 'S'] as const;
type DataGrade = 'C' | 'S' | 'O';

function blockClassifiedData(grade: DataGrade): void {
  if ((DATA_GRADE_BLOCK as readonly string[]).includes(grade)) {
    throw new Error(`BLOCKED: ${grade}등급 데이터는 AI API 전송 금지 (N2SF N-05)`);
  }
}

export interface WellReading {
  wellId: string;
  timestamp: string;
  ph: number;
  nitrate_mgL: number;
  chloride_mgL: number;
  tds_mgL: number; // 총용존고형물
  temperatureC: number;
}

export interface Threshold {
  phMin: number;
  phMax: number;
  nitrateMax: number;
  chlorideMax: number;
  tdsMax: number;
}

export interface Alert {
  wellId: string;
  timestamp: string;
  parameter: string;
  value: number;
  limit: number;
  severity: 'warn' | 'critical';
}

interface AuditEntry {
  timestamp: string;
  action: string;
  detail: Record<string, unknown>;
}

const DEFAULT_THRESHOLD: Threshold = {
  phMin: 5.8,
  phMax: 8.5,
  nitrateMax: 10, // 환경부 먹는물 기준
  chlorideMax: 250,
  tdsMax: 500,
};

export class AIGroundwaterQualityMonitor {
  private readonly audit: AuditEntry[] = [];
  private readonly readings = new Map<string, WellReading[]>();
  private threshold: Threshold = { ...DEFAULT_THRESHOLD };

  private log(action: string, detail: Record<string, unknown>): void {
    this.audit.push({ timestamp: new Date().toISOString(), action, detail });
  }

  setThreshold(t: Partial<Threshold>): void {
    this.threshold = { ...this.threshold, ...t };
    this.log('SET_THRESHOLD', { ...t });
  }

  ingest(reading: WellReading, grade: DataGrade = 'O'): Alert[] {
    blockClassifiedData(grade);
    if (reading.ph < 0 || reading.ph > 14) throw new Error('ph 범위 오류');
    const list = this.readings.get(reading.wellId) ?? [];
    list.push(reading);
    this.readings.set(reading.wellId, list);

    const alerts: Alert[] = [];
    const t = this.threshold;

    if (reading.ph < t.phMin) {
      alerts.push({ wellId: reading.wellId, timestamp: reading.timestamp, parameter: 'ph', value: reading.ph, limit: t.phMin, severity: reading.ph < t.phMin - 1 ? 'critical' : 'warn' });
    }
    if (reading.ph > t.phMax) {
      alerts.push({ wellId: reading.wellId, timestamp: reading.timestamp, parameter: 'ph', value: reading.ph, limit: t.phMax, severity: reading.ph > t.phMax + 1 ? 'critical' : 'warn' });
    }
    if (reading.nitrate_mgL > t.nitrateMax) {
      alerts.push({ wellId: reading.wellId, timestamp: reading.timestamp, parameter: 'nitrate', value: reading.nitrate_mgL, limit: t.nitrateMax, severity: reading.nitrate_mgL > t.nitrateMax * 2 ? 'critical' : 'warn' });
    }
    if (reading.chloride_mgL > t.chlorideMax) {
      alerts.push({ wellId: reading.wellId, timestamp: reading.timestamp, parameter: 'chloride', value: reading.chloride_mgL, limit: t.chlorideMax, severity: 'warn' });
    }
    if (reading.tds_mgL > t.tdsMax) {
      alerts.push({ wellId: reading.wellId, timestamp: reading.timestamp, parameter: 'tds', value: reading.tds_mgL, limit: t.tdsMax, severity: 'warn' });
    }

    this.log('INGEST', { wellId: reading.wellId, alertCount: alerts.length });
    return alerts;
  }

  getReadings(wellId: string): WellReading[] {
    return [...(this.readings.get(wellId) ?? [])];
  }

  movingAverage(wellId: string, parameter: keyof Pick<WellReading, 'ph' | 'nitrate_mgL' | 'chloride_mgL' | 'tds_mgL' | 'temperatureC'>, window: number): number {
    const list = this.readings.get(wellId) ?? [];
    if (list.length === 0) return 0;
    const slice = list.slice(-Math.max(1, window));
    const sum = slice.reduce((s, r) => s + (r[parameter] as number), 0);
    return Math.round((sum / slice.length) * 100) / 100;
  }

  getAuditLog(): AuditEntry[] {
    return [...this.audit];
  }
}
