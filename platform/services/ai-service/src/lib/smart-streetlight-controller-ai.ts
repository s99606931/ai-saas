// Design Ref: §스마트 가로등 제어 — 조도·인구 흐름 기반 디밍 최적화
// Plan SC: FR-R558.1~6

const DATA_GRADE_BLOCK = ['C', 'S'] as const;
type DataGrade = 'C' | 'S' | 'O';

function blockClassifiedData(grade: DataGrade): void {
  if ((DATA_GRADE_BLOCK as readonly string[]).includes(grade)) {
    throw new Error(`BLOCKED: ${grade}등급 데이터는 AI API 전송 금지 (N2SF N-05)`);
  }
}

export type ZoneType = 'residential' | 'commercial' | 'school' | 'park' | 'highway';

export interface StreetlightUnit {
  lightId: string;
  zoneType: ZoneType;
  ratedWattage: number;
  installedYear: number;
  lastMaintenance: string; // ISO
}

export interface SensorReading {
  lightId: string;
  timestamp: string;
  ambientLux: number;
  pedestrianCountPerMin: number;
  vehicleCountPerMin: number;
}

export interface DimmingCommand {
  lightId: string;
  brightnessPct: number; // 0~100
  estimatedWatts: number;
  reason: string;
}

interface AuditEntry {
  timestamp: string;
  action: string;
  detail: Record<string, unknown>;
}

export class SmartStreetlightController {
  private lights = new Map<string, StreetlightUnit>();
  private readings = new Map<string, SensorReading>();
  private readonly auditLog: AuditEntry[] = [];

  private append(action: string, detail: Record<string, unknown>): void {
    this.auditLog.push({ timestamp: new Date().toISOString(), action, detail });
  }

  // Plan SC: FR-R558.1
  registerLight(l: StreetlightUnit, grade: DataGrade = 'O'): void {
    blockClassifiedData(grade);
    if (l.ratedWattage <= 0) throw new Error('정격 전력은 0보다 커야 합니다');
    if (l.installedYear < 1990 || l.installedYear > 2100) {
      throw new Error('설치 연도가 올바르지 않습니다');
    }
    this.lights.set(l.lightId, { ...l });
    this.append('REGISTER_LIGHT', { lightId: l.lightId, zoneType: l.zoneType });
  }

  // Plan SC: FR-R558.2
  ingestReading(r: SensorReading, grade: DataGrade = 'O'): void {
    blockClassifiedData(grade);
    if (!this.lights.has(r.lightId)) throw new Error(`가로등 미등록: ${r.lightId}`);
    if (r.ambientLux < 0) throw new Error('조도는 0 이상이어야 합니다');
    if (r.pedestrianCountPerMin < 0 || r.vehicleCountPerMin < 0) {
      throw new Error('유동 인구/차량 수는 0 이상이어야 합니다');
    }
    this.readings.set(r.lightId, { ...r });
    this.append('INGEST_READING', { lightId: r.lightId });
  }

  // Plan SC: FR-R558.3
  computeDimming(lightId: string, grade: DataGrade = 'O'): DimmingCommand {
    blockClassifiedData(grade);
    const light = this.lights.get(lightId);
    if (!light) throw new Error(`가로등 미등록: ${lightId}`);
    const reading = this.readings.get(lightId);
    if (!reading) throw new Error(`센서 데이터 없음: ${lightId}`);

    let brightness = 70;
    const reasons: string[] = [];

    if (reading.ambientLux > 100) {
      brightness = 0;
      reasons.push('주간 자연광 충분');
    } else {
      if (reading.ambientLux > 40) {
        brightness -= 20;
        reasons.push('황혼 조도 반영');
      }
      if (light.zoneType === 'school') {
        brightness += 15;
        reasons.push('학교 구역 안전 가중');
      }
      if (light.zoneType === 'highway') {
        brightness += 10;
        reasons.push('고속도로 가시성 확보');
      }
      const flow = reading.pedestrianCountPerMin + reading.vehicleCountPerMin * 2;
      if (flow > 50) {
        brightness += 15;
        reasons.push('고밀도 유동량 반영');
      } else if (flow < 5) {
        brightness -= 20;
        reasons.push('저밀도 에너지 절감');
      }
    }

    brightness = Math.max(0, Math.min(100, brightness));
    const estimatedWatts = Math.round(((light.ratedWattage * brightness) / 100) * 100) / 100;

    const cmd: DimmingCommand = {
      lightId,
      brightnessPct: brightness,
      estimatedWatts,
      reason: reasons.join('; ') || '기본 야간 운영',
    };
    this.append('COMPUTE_DIMMING', { lightId, brightness });
    return cmd;
  }

  // Plan SC: FR-R558.4
  totalPowerConsumption(): number {
    let total = 0;
    for (const id of this.lights.keys()) {
      if (this.readings.has(id)) {
        total += this.computeDimming(id).estimatedWatts;
      }
    }
    return Math.round(total * 100) / 100;
  }

  // Plan SC: FR-R558.5
  needsMaintenance(referenceDate: string, thresholdDays = 365): string[] {
    const refTime = new Date(referenceDate).getTime();
    if (Number.isNaN(refTime)) throw new Error('기준일자가 올바르지 않습니다');
    const due: string[] = [];
    for (const l of this.lights.values()) {
      const last = new Date(l.lastMaintenance).getTime();
      if (Number.isNaN(last)) continue;
      const days = (refTime - last) / (1000 * 60 * 60 * 24);
      if (days >= thresholdDays) due.push(l.lightId);
    }
    return due;
  }

  // Plan SC: FR-R558.6
  getAuditLog(): AuditEntry[] {
    return [...this.auditLog];
  }
}
