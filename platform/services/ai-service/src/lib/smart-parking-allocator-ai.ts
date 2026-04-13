// SVC-AI-ADV-R422 Smart Parking Allocator AI
// Design Ref: SVC-AI-ADV-R422.design.md
// Plan SC: FR-422.1~5
// CSAP D-06 / N2SF N-05

export type DataGrade = 'O' | 'C' | 'S';
export type PriorityClass = 'EMERGENCY' | 'DISABLED' | 'STAFF' | 'VISITOR';

export interface ParkingRequest {
  readonly requestId: string;
  readonly priority: PriorityClass;
}

export interface Slot {
  slotId: string;
  distanceFromEntrance: number;
  occupied: boolean;
}

export interface Allocation {
  readonly requestId: string;
  readonly assigned: string | null;
  readonly reason: string;
  readonly alert?: 'SATURATED';
}

export interface AuditEntry {
  readonly timestamp: string;
  readonly action: string;
  readonly target: string;
  readonly details: Record<string, unknown>;
}

const PRIORITY_SCORE: Record<PriorityClass, number> = {
  EMERGENCY: 100,
  DISABLED: 90,
  STAFF: 60,
  VISITOR: 30,
};

export class SmartParkingAllocatorAI {
  private readonly auditLog: AuditEntry[] = [];

  allocate(
    requests: readonly ParkingRequest[],
    slots: Slot[],
    grade: DataGrade = 'O',
  ): readonly Allocation[] {
    if (grade === 'C' || grade === 'S') {
      throw new Error(`N2SF_BLOCKED: ${grade}등급 주차 데이터 차단 (N2SF N-05)`);
    }

    const sorted = [...requests].sort(
      (a, b) => PRIORITY_SCORE[b.priority] - PRIORITY_SCORE[a.priority],
    );
    const results: Allocation[] = [];
    const total = slots.length;

    for (const req of sorted) {
      const free = slots
        .filter((s) => !s.occupied)
        .sort((a, b) => a.distanceFromEntrance - b.distanceFromEntrance);
      if (free.length === 0) {
        results.push({ requestId: req.requestId, assigned: null, reason: 'NO_SLOT' });
        continue;
      }
      const pick = free[0]!;
      pick.occupied = true;
      const occupiedCount = slots.filter((s) => s.occupied).length;
      const ratio = total > 0 ? occupiedCount / total : 0;
      const alloc: Allocation =
        ratio > 0.9
          ? { requestId: req.requestId, assigned: pick.slotId, reason: 'ASSIGNED', alert: 'SATURATED' }
          : { requestId: req.requestId, assigned: pick.slotId, reason: 'ASSIGNED' };
      results.push(alloc);
      this.record('ALLOCATE', req.requestId, { slotId: pick.slotId, priority: req.priority });
    }
    return results;
  }

  getAuditLog(): readonly AuditEntry[] {
    return this.auditLog;
  }

  private record(action: string, target: string, details: Record<string, unknown>): void {
    this.auditLog.push({
      timestamp: new Date().toISOString(),
      action,
      target,
      details,
    });
  }
}
