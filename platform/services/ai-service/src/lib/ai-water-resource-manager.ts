// SVC-AI-ADV-R489 AI Water Resource Manager
// Design Ref: SVC-AI-ADV-R489.design.md §수자원관리
// Plan SC: FR-489.1~6
// CSAP D-06 / N2SF N-05

export type DataGrade = 'O' | 'C' | 'S';

export interface Reservoir {
  readonly reservoirId: string;
  readonly capacityMcm: number;
  readonly currentLevelMcm: number;
  readonly inflowMcmPerDay: number;
  readonly outflowMcmPerDay: number;
  readonly rainfallMmForecast7d: number;
}

export interface WaterPlan {
  readonly reservoirId: string;
  readonly status: 'SURPLUS' | 'NORMAL' | 'WATCH' | 'DROUGHT' | 'FLOOD_RISK';
  readonly recommendedOutflow: number;
  readonly daysUntilCritical: number;
  readonly actions: readonly string[];
}

interface AuditEntry {
  readonly timestamp: string;
  readonly action: string;
  readonly details: Record<string, unknown>;
}

function block(grade: DataGrade): void {
  if (grade === 'C' || grade === 'S') {
    throw new Error(`N2SF_BLOCKED: ${grade}등급 수자원 데이터 차단 (N2SF N-05)`);
  }
}

export class AiWaterResourceManager {
  private readonly auditLog: AuditEntry[] = [];

  plan(reservoir: Reservoir, grade: DataGrade = 'O'): WaterPlan {
    block(grade);

    const fillRatio =
      reservoir.capacityMcm > 0 ? reservoir.currentLevelMcm / reservoir.capacityMcm : 0;
    const net = reservoir.inflowMcmPerDay - reservoir.outflowMcmPerDay;

    let status: WaterPlan['status'];
    if (fillRatio > 0.95 || reservoir.rainfallMmForecast7d > 200) status = 'FLOOD_RISK';
    else if (fillRatio > 0.8) status = 'SURPLUS';
    else if (fillRatio > 0.5) status = 'NORMAL';
    else if (fillRatio > 0.25) status = 'WATCH';
    else status = 'DROUGHT';

    let recommendedOutflow: number;
    if (status === 'FLOOD_RISK') recommendedOutflow = reservoir.outflowMcmPerDay * 1.5;
    else if (status === 'SURPLUS') recommendedOutflow = reservoir.outflowMcmPerDay * 1.2;
    else if (status === 'DROUGHT') recommendedOutflow = reservoir.outflowMcmPerDay * 0.6;
    else recommendedOutflow = reservoir.outflowMcmPerDay;

    let daysUntilCritical: number;
    if (net >= 0) {
      daysUntilCritical =
        status === 'FLOOD_RISK'
          ? Math.max(1, Math.round((reservoir.capacityMcm - reservoir.currentLevelMcm) / Math.max(0.01, net)))
          : Number.POSITIVE_INFINITY;
    } else {
      daysUntilCritical = Math.max(1, Math.round(reservoir.currentLevelMcm / Math.max(0.01, -net)));
    }

    const actions: string[] = [];
    if (status === 'DROUGHT') {
      actions.push('water_restriction');
      actions.push('priority_allocation');
    }
    if (status === 'FLOOD_RISK') {
      actions.push('preemptive_discharge');
      actions.push('downstream_warning');
    }
    if (status === 'WATCH') actions.push('monitoring_intensification');
    if (actions.length === 0) actions.push('routine_monitoring');

    this.appendAudit('WATER_PLAN', {
      reservoirId: reservoir.reservoirId,
      status,
      fillRatio: Math.round(fillRatio * 100) / 100,
    });

    return {
      reservoirId: reservoir.reservoirId,
      status,
      recommendedOutflow: Math.round(recommendedOutflow * 100) / 100,
      daysUntilCritical: Number.isFinite(daysUntilCritical) ? daysUntilCritical : -1,
      actions,
    };
  }

  basinBalance(reservoirs: readonly Reservoir[]): number {
    const totalIn = reservoirs.reduce((acc, r) => acc + r.inflowMcmPerDay, 0);
    const totalOut = reservoirs.reduce((acc, r) => acc + r.outflowMcmPerDay, 0);
    const balance = Math.round((totalIn - totalOut) * 100) / 100;
    this.appendAudit('BASIN', { reservoirs: reservoirs.length, balance });
    return balance;
  }

  getAuditLog(): readonly AuditEntry[] {
    return [...this.auditLog];
  }

  private appendAudit(action: string, details: Record<string, unknown>): void {
    this.auditLog.push({
      timestamp: new Date().toISOString(),
      action,
      details,
    });
  }
}
