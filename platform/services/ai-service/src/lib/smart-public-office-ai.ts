// SVC-AI-ADV-R500 Smart Public Office AI — 500 라운드 이정표
// Design Ref: SVC-AI-ADV-R500.design.md §스마트공공기관
// Plan SC: FR-500.1~6
// CSAP D-06 / N2SF N-05

export type DataGrade = 'O' | 'C' | 'S';

const DATA_GRADE_BLOCK = ['C', 'S'] as const;

function blockClassifiedData(grade: DataGrade): void {
  if ((DATA_GRADE_BLOCK as readonly string[]).includes(grade)) {
    throw new Error(`BLOCKED: ${grade}등급 데이터는 AI API 전송 금지 (N2SF N-05)`);
  }
}

export type FacilityType =
  | 'meeting_room'
  | 'office'
  | 'auditorium'
  | 'parking'
  | 'lobby'
  | 'archive';

export interface SensorReading {
  readonly facilityId: string;
  readonly facilityType: FacilityType;
  readonly timestamp: string;
  readonly occupancy: number;
  readonly capacity: number;
  readonly temperatureC: number;
  readonly co2Ppm: number;
  readonly powerKw: number;
}

export interface FacilityOptimization {
  readonly facilityId: string;
  readonly utilizationPct: number;
  readonly comfortScore: number;
  readonly energyEfficiency: number;
  readonly recommendedActions: readonly string[];
  readonly priority: 'low' | 'medium' | 'high';
}

export interface OfficeKpi {
  readonly totalFacilities: number;
  readonly averageUtilization: number;
  readonly averageComfortScore: number;
  readonly totalPowerKw: number;
  readonly milestoneRound: number;
}

interface AuditEntry {
  readonly timestamp: string;
  readonly action: string;
  readonly detail: Record<string, unknown>;
}

export class SmartPublicOfficeAi {
  private readonly auditLog: AuditEntry[] = [];
  private readonly readings: SensorReading[] = [];
  public readonly milestoneRound = 500;

  ingest(reading: SensorReading, grade: DataGrade = 'O'): void {
    blockClassifiedData(grade);
    if (reading.capacity <= 0) {
      throw new Error('VALIDATION: capacity > 0 필요');
    }
    if (reading.occupancy < 0 || reading.occupancy > reading.capacity) {
      throw new Error('VALIDATION: occupancy 범위 오류');
    }
    this.readings.push(reading);
    this.appendAudit('INGEST', { facilityId: reading.facilityId });
  }

  optimize(facilityId: string): FacilityOptimization {
    const items = this.readings.filter((r) => r.facilityId === facilityId);
    if (items.length === 0) {
      throw new Error(`NOT_FOUND: ${facilityId}`);
    }
    const last = items[items.length - 1]!;

    const utilizationPct = (last.occupancy / last.capacity) * 100;
    const tempPenalty = Math.abs(last.temperatureC - 23) * 4;
    const co2Penalty = Math.max(0, last.co2Ppm - 1000) / 20;
    const comfortScore = Math.max(0, Math.min(100, 100 - tempPenalty - co2Penalty));

    const idealPowerPerOcc = 0.15;
    const expectedPower = Math.max(0.5, last.occupancy * idealPowerPerOcc);
    const energyEfficiency =
      last.powerKw === 0 ? 100 : Math.max(0, Math.min(100, (expectedPower / last.powerKw) * 100));

    const actions: string[] = [];
    if (utilizationPct > 90) actions.push('expand_capacity');
    else if (utilizationPct < 20) actions.push('consolidate_or_idle_off');
    if (comfortScore < 70) actions.push('hvac_tuning');
    if (last.co2Ppm > 1200) actions.push('ventilation_increase');
    if (energyEfficiency < 60) actions.push('power_audit');
    if (actions.length === 0) actions.push('continue_monitoring');

    const priority: FacilityOptimization['priority'] =
      comfortScore < 50 || energyEfficiency < 40
        ? 'high'
        : actions.length > 2
          ? 'medium'
          : 'low';

    const result: FacilityOptimization = {
      facilityId,
      utilizationPct: Math.round(utilizationPct * 100) / 100,
      comfortScore: Math.round(comfortScore * 100) / 100,
      energyEfficiency: Math.round(energyEfficiency * 100) / 100,
      recommendedActions: actions,
      priority,
    };

    this.appendAudit('OPTIMIZE', {
      facilityId,
      priority,
      actions: actions.length,
    });
    return result;
  }

  kpiSummary(): OfficeKpi {
    const facilityIds = new Set(this.readings.map((r) => r.facilityId));
    const totalFacilities = facilityIds.size;

    let utilSum = 0;
    let comfortSum = 0;
    let powerSum = 0;
    let count = 0;

    for (const id of facilityIds) {
      try {
        const opt = this.optimize(id);
        utilSum += opt.utilizationPct;
        comfortSum += opt.comfortScore;
        count++;
      } catch {
        continue;
      }
    }
    for (const r of this.readings) {
      powerSum += r.powerKw;
    }

    const summary: OfficeKpi = {
      totalFacilities,
      averageUtilization: count === 0 ? 0 : Math.round((utilSum / count) * 100) / 100,
      averageComfortScore: count === 0 ? 0 : Math.round((comfortSum / count) * 100) / 100,
      totalPowerKw: Math.round(powerSum * 100) / 100,
      milestoneRound: this.milestoneRound,
    };

    this.appendAudit('KPI_SUMMARY', {
      totalFacilities,
      milestone: this.milestoneRound,
    });
    return summary;
  }

  getAuditLog(): readonly AuditEntry[] {
    return [...this.auditLog];
  }

  private appendAudit(action: string, detail: Record<string, unknown>): void {
    this.auditLog.push({
      timestamp: new Date().toISOString(),
      action,
      detail,
    });
  }
}
