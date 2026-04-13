// Design Ref: §스마트시티 센서 집계 AI — 다종 센서 데이터 수집·통계·이상 탐지
// Plan SC: FR-R535.1~6

const DATA_GRADE_BLOCK = ['C', 'S'] as const;
type DataGrade = 'C' | 'S' | 'O';

function blockClassifiedData(grade: DataGrade): void {
  if ((DATA_GRADE_BLOCK as readonly string[]).includes(grade)) {
    throw new Error(`BLOCKED: ${grade}등급 데이터는 AI API 전송 금지 (N2SF N-05)`);
  }
}

export type SensorKind = 'temperature' | 'humidity' | 'noise' | 'traffic' | 'pedestrian' | 'parking';

export interface Sensor {
  sensorId: string;
  kind: SensorKind;
  zone: string;
  unit: string;
}

export interface SensorReading {
  sensorId: string;
  value: number;
  recordedAt: string;
}

export interface AggregateStats {
  sensorId: string;
  count: number;
  avg: number;
  min: number;
  max: number;
  stdDev: number;
}

export interface Anomaly {
  sensorId: string;
  value: number;
  zScore: number;
  recordedAt: string;
}

interface AuditEntry {
  timestamp: string;
  action: string;
  detail: Record<string, unknown>;
}

export class SmartCitySensorAggregatorAI {
  private readonly sensors = new Map<string, Sensor>();
  private readonly readings: SensorReading[] = [];
  private readonly auditLog: AuditEntry[] = [];

  private append(action: string, detail: Record<string, unknown>): void {
    this.auditLog.push({ timestamp: new Date().toISOString(), action, detail });
  }

  // Plan SC: FR-R535.1
  registerSensor(sensor: Sensor, grade: DataGrade = 'O'): void {
    blockClassifiedData(grade);
    if (sensor.zone.trim().length === 0) throw new Error('구역이 비어 있습니다');
    this.sensors.set(sensor.sensorId, { ...sensor });
    this.append('REGISTER_SENSOR', { sensorId: sensor.sensorId, kind: sensor.kind });
  }

  // Plan SC: FR-R535.2
  ingestReading(reading: SensorReading, grade: DataGrade = 'O'): void {
    blockClassifiedData(grade);
    if (!this.sensors.has(reading.sensorId)) throw new Error(`센서 미등록: ${reading.sensorId}`);
    if (!Number.isFinite(reading.value)) throw new Error('값이 유효하지 않습니다');
    this.readings.push({ ...reading });
    this.append('INGEST_READING', { sensorId: reading.sensorId });
  }

  // Plan SC: FR-R535.3
  computeStats(sensorId: string): AggregateStats {
    const values = this.readings.filter(r => r.sensorId === sensorId).map(r => r.value);
    if (values.length === 0) throw new Error(`데이터 없음: ${sensorId}`);

    const count = values.length;
    const sum = values.reduce((a, b) => a + b, 0);
    const avg = sum / count;
    const min = Math.min(...values);
    const max = Math.max(...values);
    const variance = values.reduce((s, v) => s + (v - avg) ** 2, 0) / count;
    const stdDev = Math.sqrt(variance);

    return { sensorId, count, avg, min, max, stdDev };
  }

  // Plan SC: FR-R535.4
  detectAnomalies(sensorId: string, zThreshold = 2): Anomaly[] {
    const sensorReadings = this.readings.filter(r => r.sensorId === sensorId);
    if (sensorReadings.length < 3) return [];

    const stats = this.computeStats(sensorId);
    if (stats.stdDev === 0) return [];

    const anomalies: Anomaly[] = [];
    for (const r of sensorReadings) {
      const z = Math.abs((r.value - stats.avg) / stats.stdDev);
      if (z >= zThreshold) {
        anomalies.push({ sensorId, value: r.value, zScore: Number(z.toFixed(2)), recordedAt: r.recordedAt });
      }
    }
    this.append('DETECT_ANOMALIES', { sensorId, count: anomalies.length });
    return anomalies;
  }

  // Plan SC: FR-R535.5
  listSensorsByZone(zone: string): Sensor[] {
    return Array.from(this.sensors.values()).filter(s => s.zone === zone).map(s => ({ ...s }));
  }

  // Plan SC: FR-R535.6
  getAuditLog(): AuditEntry[] {
    return [...this.auditLog];
  }
}
