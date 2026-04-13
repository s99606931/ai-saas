// Design Ref: §재난 관리 AI — 재난 이벤트 수집·심각도 판정·자원 배정
// Plan SC: FR-R531.1~6

const DATA_GRADE_BLOCK = ['C', 'S'] as const;
type DataGrade = 'C' | 'S' | 'O';

function blockClassifiedData(grade: DataGrade): void {
  if ((DATA_GRADE_BLOCK as readonly string[]).includes(grade)) {
    throw new Error(`BLOCKED: ${grade}등급 데이터는 AI API 전송 금지 (N2SF N-05)`);
  }
}

export type DisasterType = 'flood' | 'fire' | 'earthquake' | 'typhoon' | 'landslide' | 'other';
export type SeverityLevel = 'info' | 'warning' | 'alert' | 'critical';

export interface DisasterEvent {
  eventId: string;
  type: DisasterType;
  region: string;
  reportedAt: string;
  affectedPopulation: number;
  estimatedDamage: number; // 단위: 백만원
}

export interface Resource {
  resourceId: string;
  kind: string;
  capacity: number;
  region: string;
}

export interface Allocation {
  eventId: string;
  resourceId: string;
  assignedCapacity: number;
}

export interface SeverityResult {
  eventId: string;
  severity: SeverityLevel;
  score: number;
  reason: string;
}

interface AuditEntry {
  timestamp: string;
  action: string;
  detail: Record<string, unknown>;
}

export class DisasterManagementAISystem {
  private readonly events = new Map<string, DisasterEvent>();
  private readonly resources = new Map<string, Resource>();
  private readonly allocations: Allocation[] = [];
  private readonly auditLog: AuditEntry[] = [];

  private append(action: string, detail: Record<string, unknown>): void {
    this.auditLog.push({ timestamp: new Date().toISOString(), action, detail });
  }

  // Plan SC: FR-R531.1
  reportEvent(event: DisasterEvent, grade: DataGrade = 'O'): void {
    blockClassifiedData(grade);
    if (event.affectedPopulation < 0) throw new Error('영향 인구는 음수일 수 없습니다');
    if (event.estimatedDamage < 0) throw new Error('추정 피해액은 음수일 수 없습니다');
    this.events.set(event.eventId, { ...event });
    this.append('REPORT_EVENT', { eventId: event.eventId, type: event.type });
  }

  // Plan SC: FR-R531.2
  registerResource(resource: Resource, grade: DataGrade = 'O'): void {
    blockClassifiedData(grade);
    if (resource.capacity <= 0) throw new Error('자원 용량은 양수여야 합니다');
    this.resources.set(resource.resourceId, { ...resource });
    this.append('REGISTER_RESOURCE', { resourceId: resource.resourceId });
  }

  // Plan SC: FR-R531.3
  evaluateSeverity(eventId: string): SeverityResult {
    const event = this.events.get(eventId);
    if (!event) throw new Error(`재난 이벤트 미등록: ${eventId}`);

    const populationScore = Math.min(event.affectedPopulation / 100, 60);
    const damageScore = Math.min(event.estimatedDamage / 50, 40);
    const score = Math.round(populationScore + damageScore);

    let severity: SeverityLevel;
    if (score >= 80) severity = 'critical';
    else if (score >= 60) severity = 'alert';
    else if (score >= 30) severity = 'warning';
    else severity = 'info';

    const reason = `pop=${populationScore.toFixed(1)} dmg=${damageScore.toFixed(1)}`;
    this.append('EVALUATE_SEVERITY', { eventId, severity, score });
    return { eventId, severity, score, reason };
  }

  // Plan SC: FR-R531.4
  allocateResources(eventId: string): Allocation[] {
    const event = this.events.get(eventId);
    if (!event) throw new Error(`재난 이벤트 미등록: ${eventId}`);

    const regional = Array.from(this.resources.values()).filter(r => r.region === event.region);
    const required = Math.ceil(event.affectedPopulation / 100);
    const picks: Allocation[] = [];
    let remaining = required;

    for (const res of regional.sort((a, b) => b.capacity - a.capacity)) {
      if (remaining <= 0) break;
      const take = Math.min(res.capacity, remaining);
      picks.push({ eventId, resourceId: res.resourceId, assignedCapacity: take });
      remaining -= take;
    }

    for (const p of picks) this.allocations.push(p);
    this.append('ALLOCATE_RESOURCES', { eventId, count: picks.length, unmet: remaining });
    return picks;
  }

  // Plan SC: FR-R531.5
  listAllocations(eventId: string): Allocation[] {
    return this.allocations.filter(a => a.eventId === eventId).map(a => ({ ...a }));
  }

  // Plan SC: FR-R531.6
  getAuditLog(): AuditEntry[] {
    return [...this.auditLog];
  }
}
