// Design Ref: §도시 소음 지도 — 소음 레벨 집계 및 위반 탐지
// Plan SC: FR-R606.1~6

const DATA_GRADE_BLOCK = ['C', 'S'] as const;
type DataGrade = 'C' | 'S' | 'O';

function blockClassifiedData(grade: DataGrade): void {
  if ((DATA_GRADE_BLOCK as readonly string[]).includes(grade)) {
    throw new Error(`BLOCKED: ${grade}등급 데이터는 AI API 전송 금지 (N2SF N-05)`);
  }
}

export type ZoneType = 'residential' | 'commercial' | 'industrial' | 'school_hospital';
export type TimeBand = 'day' | 'night';

export interface NoiseReading {
  sensorId: string;
  zoneType: ZoneType;
  timeBand: TimeBand;
  decibel: number;
  timestamp: string;
}

export interface ViolationReport {
  sensorId: string;
  zoneType: ZoneType;
  timeBand: TimeBand;
  decibel: number;
  limit: number;
  excessDb: number;
}

const NOISE_LIMITS: Record<ZoneType, Record<TimeBand, number>> = {
  residential: { day: 55, night: 45 },
  commercial: { day: 65, night: 55 },
  industrial: { day: 70, night: 65 },
  school_hospital: { day: 50, night: 40 },
};

interface AuditEntry {
  timestamp: string;
  action: string;
  detail: Record<string, unknown>;
}

export class UrbanNoiseMappingAI {
  private readings: NoiseReading[] = [];
  private auditLog: AuditEntry[] = [];

  private append(action: string, detail: Record<string, unknown>): void {
    this.auditLog.push({ timestamp: new Date().toISOString(), action, detail });
  }

  // Plan SC: FR-R606.1
  recordReading(reading: NoiseReading, grade: DataGrade = 'O'): void {
    blockClassifiedData(grade);
    if (reading.decibel < 0 || reading.decibel > 200) {
      throw new Error('데시벨은 0~200 범위여야 합니다');
    }
    if (!reading.sensorId) throw new Error('센서 ID가 필요합니다');
    this.readings.push({ ...reading });
    this.append('RECORD_READING', { sensorId: reading.sensorId, decibel: reading.decibel });
  }

  // Plan SC: FR-R606.2
  detectViolations(): ViolationReport[] {
    const violations: ViolationReport[] = [];
    for (const r of this.readings) {
      const limit = NOISE_LIMITS[r.zoneType][r.timeBand];
      if (r.decibel > limit) {
        violations.push({
          sensorId: r.sensorId,
          zoneType: r.zoneType,
          timeBand: r.timeBand,
          decibel: r.decibel,
          limit,
          excessDb: Math.round((r.decibel - limit) * 100) / 100,
        });
      }
    }
    return violations;
  }

  // Plan SC: FR-R606.3
  avgByZone(): Record<ZoneType, number> {
    const sum: Record<ZoneType, number> = {
      residential: 0,
      commercial: 0,
      industrial: 0,
      school_hospital: 0,
    };
    const count: Record<ZoneType, number> = {
      residential: 0,
      commercial: 0,
      industrial: 0,
      school_hospital: 0,
    };
    for (const r of this.readings) {
      sum[r.zoneType] += r.decibel;
      count[r.zoneType]++;
    }
    const result: Record<ZoneType, number> = {
      residential: 0,
      commercial: 0,
      industrial: 0,
      school_hospital: 0,
    };
    (Object.keys(sum) as ZoneType[]).forEach(z => {
      result[z] = count[z] === 0 ? 0 : Math.round((sum[z] / count[z]) * 100) / 100;
    });
    return result;
  }

  // Plan SC: FR-R606.4
  peakReading(sensorId: string): NoiseReading | undefined {
    const filtered = this.readings.filter(r => r.sensorId === sensorId);
    if (filtered.length === 0) return undefined;
    let peak = filtered[0]!;
    for (const r of filtered) {
      if (r.decibel > peak.decibel) peak = r;
    }
    return { ...peak };
  }

  // Plan SC: FR-R606.5
  getLimit(zoneType: ZoneType, timeBand: TimeBand): number {
    return NOISE_LIMITS[zoneType][timeBand];
  }

  // Plan SC: FR-R606.6
  getAuditLog(): AuditEntry[] {
    return [...this.auditLog];
  }
}
