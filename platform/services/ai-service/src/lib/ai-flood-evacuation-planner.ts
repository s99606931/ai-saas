// Design Ref: §AI 홍수 대피 계획 — 수위 예측·경로 배정
// Plan SC: FR-R572.1~6

const DATA_GRADE_BLOCK = ['C', 'S'] as const;
type DataGrade = 'C' | 'S' | 'O';

function blockClassifiedData(grade: DataGrade): void {
  if ((DATA_GRADE_BLOCK as readonly string[]).includes(grade)) {
    throw new Error(`BLOCKED: ${grade}등급 데이터는 AI API 전송 금지 (N2SF N-05)`);
  }
}

export type FloodLevel = 'normal' | 'watch' | 'warning' | 'emergency';

export interface Zone {
  zoneId: string;
  name: string;
  population: number;
  elevationM: number;
  nearestShelterId: string;
}

export interface Shelter {
  shelterId: string;
  name: string;
  capacity: number;
  elevationM: number;
  availableSlots: number;
}

export interface WaterLevelReading {
  zoneId: string;
  currentLevelM: number;
  riverLevelM: number;
  rainfallMmPerHour: number;
  readingTime: string;
}

export interface EvacuationPlan {
  zoneId: string;
  level: FloodLevel;
  recommendedShelterId: string | null;
  peopleToEvacuate: number;
  estimatedMinutes: number;
  instructions: string[];
}

interface AuditEntry {
  timestamp: string;
  action: string;
  detail: Record<string, unknown>;
}

export class AIFloodEvacuationPlanner {
  private zones = new Map<string, Zone>();
  private shelters = new Map<string, Shelter>();
  private readings = new Map<string, WaterLevelReading>();
  private auditLog: AuditEntry[] = [];

  private append(action: string, detail: Record<string, unknown>): void {
    this.auditLog.push({ timestamp: new Date().toISOString(), action, detail });
  }

  // Plan SC: FR-R572.1
  registerZone(zone: Zone, grade: DataGrade = 'O'): void {
    blockClassifiedData(grade);
    if (zone.population < 0) throw new Error('인구 수는 0 이상이어야 합니다');
    this.zones.set(zone.zoneId, { ...zone });
    this.append('REGISTER_ZONE', { zoneId: zone.zoneId });
  }

  // Plan SC: FR-R572.2
  registerShelter(shelter: Shelter, grade: DataGrade = 'O'): void {
    blockClassifiedData(grade);
    if (shelter.capacity < 0) throw new Error('수용능력은 0 이상이어야 합니다');
    this.shelters.set(shelter.shelterId, { ...shelter });
    this.append('REGISTER_SHELTER', { shelterId: shelter.shelterId });
  }

  // Plan SC: FR-R572.3
  updateWaterLevel(reading: WaterLevelReading, grade: DataGrade = 'O'): void {
    blockClassifiedData(grade);
    if (reading.currentLevelM < 0 || reading.rainfallMmPerHour < 0) {
      throw new Error('수위/강수량은 0 이상이어야 합니다');
    }
    this.readings.set(reading.zoneId, { ...reading });
    this.append('UPDATE_WATER_LEVEL', { zoneId: reading.zoneId, level: reading.currentLevelM });
  }

  // Plan SC: FR-R572.4
  classifyLevel(zoneId: string): FloodLevel {
    const reading = this.readings.get(zoneId);
    if (!reading) return 'normal';
    const zone = this.zones.get(zoneId);
    if (!zone) throw new Error(`구역 미등록: ${zoneId}`);

    const diff = reading.currentLevelM - zone.elevationM;
    if (diff >= 1.5 || reading.rainfallMmPerHour >= 80) return 'emergency';
    if (diff >= 0.8 || reading.rainfallMmPerHour >= 50) return 'warning';
    if (diff >= 0.3 || reading.rainfallMmPerHour >= 30) return 'watch';
    return 'normal';
  }

  // Plan SC: FR-R572.5
  planEvacuation(zoneId: string, grade: DataGrade = 'O'): EvacuationPlan {
    blockClassifiedData(grade);
    const zone = this.zones.get(zoneId);
    if (!zone) throw new Error(`구역 미등록: ${zoneId}`);

    const level = this.classifyLevel(zoneId);
    const instructions: string[] = [];
    let recommendedShelterId: string | null = null;
    let peopleToEvacuate = 0;
    let estimatedMinutes = 0;

    if (level === 'normal') {
      instructions.push('정상 — 예방 조치 유지');
    } else {
      const nearest = this.shelters.get(zone.nearestShelterId);
      if (nearest && nearest.availableSlots > 0) {
        recommendedShelterId = nearest.shelterId;
      } else {
        const alt = Array.from(this.shelters.values())
          .filter(s => s.availableSlots > 0 && s.elevationM > zone.elevationM)
          .sort((a, b) => b.availableSlots - a.availableSlots)[0];
        recommendedShelterId = alt?.shelterId ?? null;
      }

      if (level === 'watch') {
        peopleToEvacuate = Math.ceil(zone.population * 0.2);
        estimatedMinutes = 30;
        instructions.push('감시 경보 — 취약계층 우선 대피');
      } else if (level === 'warning') {
        peopleToEvacuate = Math.ceil(zone.population * 0.6);
        estimatedMinutes = 20;
        instructions.push('경계 경보 — 위험 구역 주민 대피');
      } else {
        peopleToEvacuate = zone.population;
        estimatedMinutes = 10;
        instructions.push('긴급 경보 — 전 주민 즉시 대피');
      }

      if (!recommendedShelterId) {
        instructions.push('대피소 포화 — 대체 거점 필요');
      }
    }

    this.append('PLAN_EVACUATION', { zoneId, level, peopleToEvacuate });
    return {
      zoneId,
      level,
      recommendedShelterId,
      peopleToEvacuate,
      estimatedMinutes,
      instructions,
    };
  }

  // Plan SC: FR-R572.6
  getAuditLog(): AuditEntry[] {
    return [...this.auditLog];
  }
}
