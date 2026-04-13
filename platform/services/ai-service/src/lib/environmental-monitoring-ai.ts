// Design Ref: §환경 모니터링 AI — 대기·수질 측정값 수집·임계 판정
// Plan SC: FR-R532.1~6

const DATA_GRADE_BLOCK = ['C', 'S'] as const;
type DataGrade = 'C' | 'S' | 'O';

function blockClassifiedData(grade: DataGrade): void {
  if ((DATA_GRADE_BLOCK as readonly string[]).includes(grade)) {
    throw new Error(`BLOCKED: ${grade}등급 데이터는 AI API 전송 금지 (N2SF N-05)`);
  }
}

export type MetricKind = 'pm25' | 'pm10' | 'o3' | 'no2' | 'ph' | 'turbidity';
export type AirLevel = 'good' | 'moderate' | 'unhealthy' | 'hazardous';

export interface Measurement {
  stationId: string;
  kind: MetricKind;
  value: number;
  unit: string;
  measuredAt: string;
}

export interface Station {
  stationId: string;
  name: string;
  region: string;
  installedAt: string;
}

export interface Threshold {
  kind: MetricKind;
  moderate: number;
  unhealthy: number;
  hazardous: number;
}

export interface Assessment {
  stationId: string;
  kind: MetricKind;
  level: AirLevel;
  value: number;
}

interface AuditEntry {
  timestamp: string;
  action: string;
  detail: Record<string, unknown>;
}

export class EnvironmentalMonitoringAI {
  private readonly stations = new Map<string, Station>();
  private readonly measurements: Measurement[] = [];
  private readonly thresholds = new Map<MetricKind, Threshold>();
  private readonly auditLog: AuditEntry[] = [];

  constructor() {
    this.thresholds.set('pm25', { kind: 'pm25', moderate: 15, unhealthy: 35, hazardous: 75 });
    this.thresholds.set('pm10', { kind: 'pm10', moderate: 30, unhealthy: 80, hazardous: 150 });
    this.thresholds.set('o3', { kind: 'o3', moderate: 0.06, unhealthy: 0.09, hazardous: 0.15 });
    this.thresholds.set('no2', { kind: 'no2', moderate: 0.03, unhealthy: 0.06, hazardous: 0.2 });
    this.thresholds.set('ph', { kind: 'ph', moderate: 6, unhealthy: 5, hazardous: 4 });
    this.thresholds.set('turbidity', { kind: 'turbidity', moderate: 1, unhealthy: 4, hazardous: 10 });
  }

  private append(action: string, detail: Record<string, unknown>): void {
    this.auditLog.push({ timestamp: new Date().toISOString(), action, detail });
  }

  // Plan SC: FR-R532.1
  registerStation(station: Station, grade: DataGrade = 'O'): void {
    blockClassifiedData(grade);
    if (station.name.trim().length === 0) throw new Error('측정소 이름이 비어 있습니다');
    this.stations.set(station.stationId, { ...station });
    this.append('REGISTER_STATION', { stationId: station.stationId });
  }

  // Plan SC: FR-R532.2
  ingestMeasurement(m: Measurement, grade: DataGrade = 'O'): void {
    blockClassifiedData(grade);
    if (!this.stations.has(m.stationId)) throw new Error(`측정소 미등록: ${m.stationId}`);
    if (!Number.isFinite(m.value)) throw new Error('측정값이 유효하지 않습니다');
    this.measurements.push({ ...m });
    this.append('INGEST_MEASUREMENT', { stationId: m.stationId, kind: m.kind });
  }

  // Plan SC: FR-R532.3
  assess(stationId: string, kind: MetricKind): Assessment {
    const latest = [...this.measurements]
      .reverse()
      .find(m => m.stationId === stationId && m.kind === kind);
    if (!latest) throw new Error(`측정값 없음: ${stationId}/${kind}`);

    const th = this.thresholds.get(kind);
    if (!th) throw new Error(`임계값 미등록: ${kind}`);

    let level: AirLevel = 'good';
    if (kind === 'ph') {
      // pH는 낮을수록 위험
      if (latest.value <= th.hazardous) level = 'hazardous';
      else if (latest.value <= th.unhealthy) level = 'unhealthy';
      else if (latest.value <= th.moderate) level = 'moderate';
    } else {
      if (latest.value >= th.hazardous) level = 'hazardous';
      else if (latest.value >= th.unhealthy) level = 'unhealthy';
      else if (latest.value >= th.moderate) level = 'moderate';
    }

    const result: Assessment = { stationId, kind, level, value: latest.value };
    this.append('ASSESS', { stationId, kind, level });
    return result;
  }

  // Plan SC: FR-R532.4
  listMeasurements(stationId: string): Measurement[] {
    return this.measurements.filter(m => m.stationId === stationId).map(m => ({ ...m }));
  }

  // Plan SC: FR-R532.5
  listStations(): Station[] {
    return Array.from(this.stations.values()).map(s => ({ ...s }));
  }

  // Plan SC: FR-R532.6
  getAuditLog(): AuditEntry[] {
    return [...this.auditLog];
  }
}
