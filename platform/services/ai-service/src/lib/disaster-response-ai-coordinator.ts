// SVC-AI-ADV-R481 Disaster Response AI Coordinator
// Design Ref: SVC-AI-ADV-R481.design.md §재난대응
// Plan SC: FR-481.1~6
// CSAP D-06 / N2SF N-05

export type DataGrade = 'O' | 'C' | 'S';

export type DisasterType = 'EARTHQUAKE' | 'FLOOD' | 'WILDFIRE' | 'TYPHOON' | 'LANDSLIDE' | 'PANDEMIC';

export interface DisasterEvent {
  readonly eventId: string;
  readonly type: DisasterType;
  readonly severity: 1 | 2 | 3 | 4 | 5;
  readonly affectedPopulation: number;
  readonly latitudeDeg: number;
  readonly longitudeDeg: number;
  readonly reportedAt: string;
}

export interface ResourceUnit {
  readonly unitId: string;
  readonly kind: 'AMBULANCE' | 'FIRE_TRUCK' | 'RESCUE_TEAM' | 'SHELTER' | 'HELICOPTER';
  readonly capacity: number;
  readonly readyMinutes: number;
}

export interface DispatchPlan {
  readonly eventId: string;
  readonly priority: 'P1' | 'P2' | 'P3' | 'P4';
  readonly assignedUnits: readonly string[];
  readonly evacuationCenters: number;
  readonly etaMinutes: number;
}

interface AuditEntry {
  readonly timestamp: string;
  readonly action: string;
  readonly details: Record<string, unknown>;
}

const SEVERITY_PRIORITY: Record<number, DispatchPlan['priority']> = {
  5: 'P1',
  4: 'P1',
  3: 'P2',
  2: 'P3',
  1: 'P4',
};

function block(grade: DataGrade): void {
  if (grade === 'C' || grade === 'S') {
    throw new Error(`N2SF_BLOCKED: ${grade}등급 재난 데이터 차단 (N2SF N-05)`);
  }
}

export class DisasterResponseAiCoordinator {
  private readonly auditLog: AuditEntry[] = [];

  coordinate(
    event: DisasterEvent,
    units: readonly ResourceUnit[],
    grade: DataGrade = 'O',
  ): DispatchPlan {
    block(grade);

    const priority = SEVERITY_PRIORITY[event.severity] ?? 'P4';
    const requiredCapacity = Math.max(1, Math.ceil(event.affectedPopulation / 100));
    const sortedUnits = [...units].sort((a, b) => a.readyMinutes - b.readyMinutes);

    const assigned: string[] = [];
    let cumulativeCapacity = 0;
    let maxEta = 0;
    for (const unit of sortedUnits) {
      if (cumulativeCapacity >= requiredCapacity) break;
      assigned.push(unit.unitId);
      cumulativeCapacity += unit.capacity;
      if (unit.readyMinutes > maxEta) maxEta = unit.readyMinutes;
    }

    const evacuationCenters = Math.ceil(event.affectedPopulation / 500);

    const plan: DispatchPlan = {
      eventId: event.eventId,
      priority,
      assignedUnits: assigned,
      evacuationCenters,
      etaMinutes: maxEta,
    };

    this.appendAudit('DISASTER_DISPATCH', {
      eventId: event.eventId,
      type: event.type,
      priority,
      unitCount: assigned.length,
    });

    return plan;
  }

  computeRiskIndex(events: readonly DisasterEvent[]): number {
    if (events.length === 0) return 0;
    const total = events.reduce((acc, e) => acc + e.severity * Math.log10(Math.max(10, e.affectedPopulation)), 0);
    const idx = Math.min(100, Math.round((total / events.length) * 5));
    this.appendAudit('RISK_INDEX', { count: events.length, idx });
    return idx;
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
