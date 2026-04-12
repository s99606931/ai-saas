// SVC-AI-ADV-R350 Emergency Resource Allocator
// Design Ref: SVC-AI-ADV-R350.design.md §알고리즘
// Plan SC: SC-R350-1 (우선순위), SC-R350-2 (거리매칭), SC-R350-3 (N2SF), SC-R350-4 (감사)
// CSAP: D-06 감사, D-08 접근통제

export type ResourceType = 'fire' | 'police' | 'ambulance';
export type ResourceStatus = 'available' | 'dispatched' | 'offline';
export type IncidentPriority = 'critical' | 'high' | 'medium' | 'low';
export type DataGrade = 'O' | 'C' | 'S';

export interface Resource {
  readonly id: string;
  readonly type: ResourceType;
  readonly lat: number;
  readonly lng: number;
  status: ResourceStatus;
}

export interface Incident {
  readonly id: string;
  readonly type: ResourceType;
  readonly priority: IncidentPriority;
  readonly lat: number;
  readonly lng: number;
  readonly grade: DataGrade;
}

export interface Allocation {
  readonly incidentId: string;
  readonly resourceId: string | null;
  readonly reason: string;
  readonly decidedAt: string;
}

export interface AuditEntry {
  readonly timestamp: string;
  readonly action: string;
  readonly target: string;
  readonly details: Record<string, unknown>;
}

const PRIORITY_WEIGHT: Record<IncidentPriority, number> = {
  critical: 1000,
  high: 100,
  medium: 10,
  low: 1,
};

export class EmergencyResourceAllocator {
  private readonly resources = new Map<string, Resource>();
  private readonly incidents = new Map<string, Incident>();
  private readonly auditLog: AuditEntry[] = [];

  registerResource(
    id: string,
    type: ResourceType,
    lat: number,
    lng: number,
    status: ResourceStatus = 'available',
  ): Resource {
    const resource: Resource = { id, type, lat, lng, status };
    this.resources.set(id, resource);
    this.record('RESOURCE_REGISTER', id, { type, status });
    return resource;
  }

  reportIncident(
    id: string,
    type: ResourceType,
    priority: IncidentPriority,
    lat: number,
    lng: number,
    grade: DataGrade,
  ): Incident {
    if (grade === 'C' || grade === 'S') {
      throw new Error(`N2SF_BLOCKED: ${grade}등급 사건 데이터는 본 분석기에 등록 금지 (N2SF N-05)`);
    }
    const incident: Incident = { id, type, priority, lat, lng, grade };
    this.incidents.set(id, incident);
    this.record('INCIDENT_REPORT', id, { type, priority });
    return incident;
  }

  allocate(incidentId: string): Allocation {
    const incident = this.incidents.get(incidentId);
    if (!incident) {
      throw new Error(`UNKNOWN_INCIDENT: ${incidentId}`);
    }
    const priorityWeight = PRIORITY_WEIGHT[incident.priority];
    let best: { id: string; score: number } | null = null;
    for (const resource of this.resources.values()) {
      if (resource.type !== incident.type) continue;
      if (resource.status !== 'available') continue;
      const distance = this.euclideanKm(resource.lat, resource.lng, incident.lat, incident.lng);
      const score = priorityWeight - distance;
      if (best === null || score > best.score) {
        best = { id: resource.id, score };
      }
    }

    const decidedAt = new Date().toISOString();
    if (best === null) {
      const alloc: Allocation = {
        incidentId,
        resourceId: null,
        reason: 'NO_AVAILABLE_RESOURCE',
        decidedAt,
      };
      this.record('ALLOCATE_FAIL', incidentId, { priority: incident.priority });
      return alloc;
    }

    const selected = this.resources.get(best.id);
    if (selected) {
      selected.status = 'dispatched';
    }
    const alloc: Allocation = {
      incidentId,
      resourceId: best.id,
      reason: `score=${best.score.toFixed(2)}`,
      decidedAt,
    };
    this.record('ALLOCATE', incidentId, { resourceId: best.id, score: best.score });
    return alloc;
  }

  getAuditLog(): readonly AuditEntry[] {
    return this.auditLog;
  }

  private euclideanKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
    const dy = (lat1 - lat2) * 111;
    const dx = (lng1 - lng2) * 88;
    return Math.sqrt(dx * dx + dy * dy);
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
