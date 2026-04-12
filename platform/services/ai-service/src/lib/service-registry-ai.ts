// Design Ref: §핵심 알고리즘 — TTL 만료 + 태그/유형 필터 발견
// Plan SC: FR-R281.1~5

enum DataGrade { C = 'C', S = 'S', O = 'O' }

interface ServiceEntry {
  id: string;
  name: string;
  endpoint: string;
  tags: string[];
  type: string;
  healthy: boolean;
  registeredAt: number;
  ttlMs: number;
}

interface DiscoverFilter {
  tag?: string;
  type?: string;
  healthyOnly?: boolean;
}

interface AuditEntry {
  timestamp: string;
  action: string;
  details: Record<string, unknown>;
}

// Plan SC: FR-R281.5
function guardDataGrade(grade: DataGrade): void {
  if (grade === DataGrade.C || grade === DataGrade.S) {
    throw new Error(`BLOCKED: ${grade}등급 데이터는 AI API 전송 금지 (N2SF N-05)`);
  }
}

export class ServiceRegistryAI {
  private services = new Map<string, ServiceEntry>();
  private auditLog: AuditEntry[] = [];

  private log(action: string, details: Record<string, unknown>): void {
    this.auditLog.push({ timestamp: new Date().toISOString(), action, details });
  }

  private isExpired(entry: ServiceEntry): boolean {
    return entry.ttlMs > 0 && (Date.now() - entry.registeredAt) > entry.ttlMs;
  }

  // Plan SC: FR-R281.1
  register(id: string, name: string, endpoint: string, tags: string[] = [], type: string = 'generic', ttlMs: number = 0): void {
    this.services.set(id, { id, name, endpoint, tags, type, healthy: true, registeredAt: Date.now(), ttlMs });
    this.log('REGISTER', { id, name, endpoint, type, ttlMs });
  }

  // Plan SC: FR-R281.2
  discover(filter: DiscoverFilter = {}, grade: DataGrade = DataGrade.O): ServiceEntry[] {
    guardDataGrade(grade);
    const results: ServiceEntry[] = [];
    for (const entry of this.services.values()) {
      if (this.isExpired(entry)) continue;
      if (filter.tag && !entry.tags.includes(filter.tag)) continue;
      if (filter.type && entry.type !== filter.type) continue;
      if (filter.healthyOnly && !entry.healthy) continue;
      results.push({ ...entry });
    }
    this.log('DISCOVER', { filter, resultCount: results.length });
    return results;
  }

  // Plan SC: FR-R281.3
  updateHealth(id: string, healthy: boolean): void {
    const entry = this.services.get(id);
    if (!entry) throw new Error(`서비스 미등록: ${id}`);
    entry.healthy = healthy;
    this.log('UPDATE_HEALTH', { id, healthy });
  }

  deregister(id: string): void {
    if (!this.services.has(id)) throw new Error(`서비스 미등록: ${id}`);
    this.services.delete(id);
    this.log('DEREGISTER', { id });
  }

  // Plan SC: FR-R281.4
  pruneExpired(): number {
    const before = this.services.size;
    for (const [id, entry] of this.services.entries()) {
      if (this.isExpired(entry)) this.services.delete(id);
    }
    const removed = before - this.services.size;
    if (removed > 0) this.log('PRUNE_EXPIRED', { removed });
    return removed;
  }

  // Plan SC: FR-R281.5
  getAuditLog(): AuditEntry[] {
    return [...this.auditLog];
  }
}
