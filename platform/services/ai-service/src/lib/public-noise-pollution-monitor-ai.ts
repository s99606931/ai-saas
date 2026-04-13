// Design Ref: §핵심 알고리즘 — 시간대별 소음 한도 비교 및 위반 추적
// Plan SC: FR-R516.1~5

const DATA_GRADE_BLOCK = ['C', 'S'] as const;
type DataGrade = 'C' | 'S' | 'O';

function blockClassifiedData(grade: DataGrade): void {
  if ((DATA_GRADE_BLOCK as readonly string[]).includes(grade)) {
    throw new Error(`BLOCKED: ${grade}등급 데이터는 AI API 전송 금지 (N2SF N-05)`);
  }
}

type ZoneType = 'residential' | 'commercial' | 'industrial' | 'mixed';
type TimeBand = 'day' | 'night';

interface NoiseReading {
  sensorId: string;
  zone: ZoneType;
  decibel: number;
  timestamp: string;
}

interface ViolationRecord {
  sensorId: string;
  zone: ZoneType;
  decibel: number;
  limit: number;
  band: TimeBand;
  timestamp: string;
}

interface AuditEntry {
  timestamp: string;
  action: string;
  detail: Record<string, unknown>;
}

const NOISE_LIMITS: Record<ZoneType, Record<TimeBand, number>> = {
  residential: { day: 55, night: 45 },
  commercial: { day: 65, night: 55 },
  industrial: { day: 70, night: 65 },
  mixed: { day: 60, night: 50 },
};

export class PublicNoisePollutionMonitorAI {
  private readings: NoiseReading[] = [];
  private violations: ViolationRecord[] = [];
  private readonly auditLog: AuditEntry[] = [];

  private appendAudit(action: string, detail: Record<string, unknown>): void {
    this.auditLog.push({ timestamp: new Date().toISOString(), action, detail });
  }

  private getBand(timestamp: string): TimeBand {
    const hour = new Date(timestamp).getUTCHours();
    return hour >= 6 && hour < 22 ? 'day' : 'night';
  }

  // Plan SC: FR-R516.1
  ingestReading(reading: NoiseReading, grade: DataGrade = 'O'): void {
    blockClassifiedData(grade);
    if (reading.decibel < 0) throw new Error('decibel >= 0 필요');
    this.readings.push(reading);
    this.appendAudit('INGEST_READING', { sensorId: reading.sensorId, decibel: reading.decibel });

    const band = this.getBand(reading.timestamp);
    const limit = NOISE_LIMITS[reading.zone][band];
    if (reading.decibel > limit) {
      this.violations.push({
        sensorId: reading.sensorId,
        zone: reading.zone,
        decibel: reading.decibel,
        limit,
        band,
        timestamp: reading.timestamp,
      });
      this.appendAudit('VIOLATION_DETECTED', { sensorId: reading.sensorId, decibel: reading.decibel, limit });
    }
  }

  // Plan SC: FR-R516.2
  computeAverage(sensorId: string): number {
    const subset = this.readings.filter(r => r.sensorId === sensorId);
    if (subset.length === 0) return 0;
    const sum = subset.reduce((s, r) => s + r.decibel, 0);
    return Math.round((sum / subset.length) * 10) / 10;
  }

  // Plan SC: FR-R516.3
  getViolations(sensorId?: string): ViolationRecord[] {
    if (sensorId) return this.violations.filter(v => v.sensorId === sensorId);
    return [...this.violations];
  }

  // Plan SC: FR-R516.4
  computeRiskLevel(sensorId: string): 'low' | 'medium' | 'high' {
    const violations = this.getViolations(sensorId);
    const total = this.readings.filter(r => r.sensorId === sensorId).length;
    if (total === 0) return 'low';
    const ratio = violations.length / total;
    if (ratio >= 0.4) return 'high';
    if (ratio >= 0.15) return 'medium';
    return 'low';
  }

  // Plan SC: FR-R516.5
  getAuditLog(): AuditEntry[] {
    return [...this.auditLog];
  }
}
