/**
 * 플랫폼 통합 허브 (MTU-N491~N500)
 * Design Ref: R11 완성도 레이어
 * Plan SC: FR-N491.* ~ FR-N500.*
 *
 * 10개 MTU를 통합한 핵심 런타임 모듈:
 * - N491: 플랫폼 헬스 통합 인덱스
 * - N492: 서비스 디스커버리 캐시
 * - N493: 분산 구성 관리자
 * - N494: 테넌트 라우팅 테이블
 * - N495: 인증 토큰 통합 검증
 * - N496: 허가 캐시 TTL 관리
 * - N497: 감사 이벤트 파이프라인
 * - N498: 메트릭 집계 기저
 * - N499: 통합 로그 수집기
 * - N500: 플랫폼 상태 스냅샷
 */

// ============ MTU-N491: Platform Health Index ============

export interface HealthCheck {
  component: string;
  status: 'up' | 'degraded' | 'down';
  latencyMs: number;
  lastCheckedAt: string;
}

export class PlatformHealthIndex {
  private checks = new Map<string, HealthCheck>();

  report(check: HealthCheck): void {
    this.checks.set(check.component, { ...check });
  }

  overall(): 'healthy' | 'degraded' | 'unhealthy' {
    const statuses = Array.from(this.checks.values()).map((c) => c.status);
    if (statuses.length === 0) return 'healthy';
    if (statuses.some((s) => s === 'down')) return 'unhealthy';
    if (statuses.some((s) => s === 'degraded')) return 'degraded';
    return 'healthy';
  }

  snapshot(): HealthCheck[] {
    return Array.from(this.checks.values()).map((c) => ({ ...c }));
  }
}

// ============ MTU-N492: Service Discovery Cache ============

export interface ServiceEndpoint {
  serviceId: string;
  url: string;
  weight: number;
  healthy: boolean;
  registeredAt: string;
}

export class ServiceDiscoveryCache {
  private cache = new Map<string, ServiceEndpoint[]>();

  register(endpoint: ServiceEndpoint): void {
    const list = this.cache.get(endpoint.serviceId) ?? [];
    const existingIdx = list.findIndex((e) => e.url === endpoint.url);
    if (existingIdx >= 0) list[existingIdx] = { ...endpoint };
    else list.push({ ...endpoint });
    this.cache.set(endpoint.serviceId, list);
  }

  /**
   * 가중 라운드로빈 선택
   */
  pick(serviceId: string): ServiceEndpoint | null {
    const list = (this.cache.get(serviceId) ?? []).filter((e) => e.healthy);
    if (list.length === 0) return null;
    const totalWeight = list.reduce((s, e) => s + e.weight, 0);
    if (totalWeight === 0) return list[0] ?? null;
    let r = Math.random() * totalWeight;
    for (const e of list) {
      r -= e.weight;
      if (r <= 0) return { ...e };
    }
    return { ...(list[list.length - 1] ?? list[0] ?? { serviceId, url: '', weight: 0, healthy: false, registeredAt: '' }) };
  }

  deregister(serviceId: string, url: string): void {
    const list = this.cache.get(serviceId) ?? [];
    this.cache.set(
      serviceId,
      list.filter((e) => e.url !== url),
    );
  }
}

// ============ MTU-N493: Distributed Config Manager ============

export interface ConfigEntry {
  key: string;
  value: string;
  version: number;
  updatedAt: string;
  encrypted: boolean;
}

export class DistributedConfigManager {
  private entries = new Map<string, ConfigEntry>();

  set(key: string, value: string, encrypted = false): ConfigEntry {
    const existing = this.entries.get(key);
    const entry: ConfigEntry = {
      key,
      value,
      version: (existing?.version ?? 0) + 1,
      updatedAt: new Date().toISOString(),
      encrypted,
    };
    this.entries.set(key, entry);
    return entry;
  }

  get(key: string): ConfigEntry | undefined {
    const entry = this.entries.get(key);
    return entry ? { ...entry } : undefined;
  }

  /**
   * N2SF: 시크릿(encrypted=true) 값은 조회 시 마스킹
   */
  getSafe(key: string): Omit<ConfigEntry, 'value'> | undefined {
    const entry = this.entries.get(key);
    if (!entry) return undefined;
    const { value: _value, ...rest } = entry;
    return { ...rest };
  }
}

// ============ MTU-N494: Tenant Routing Table ============

export interface TenantRoute {
  tenantId: string;
  shardId: string;
  region: string;
  dataGrade: 'C' | 'S' | 'O';
}

export class TenantRoutingTable {
  private routes = new Map<string, TenantRoute>();

  set(route: TenantRoute): void {
    this.routes.set(route.tenantId, { ...route });
  }

  resolve(tenantId: string): TenantRoute | undefined {
    const route = this.routes.get(tenantId);
    return route ? { ...route } : undefined;
  }

  /**
   * N2SF: C/S 등급 테넌트는 특정 region으로만
   */
  validatePlacement(tenantId: string, targetRegion: string): boolean {
    const route = this.routes.get(tenantId);
    if (!route) return false;
    if (route.dataGrade === 'C' || route.dataGrade === 'S') {
      return route.region === targetRegion;
    }
    return true;
  }
}

// ============ MTU-N495: Unified Token Verifier ============

export interface TokenClaims {
  sub: string;
  iss: string;
  exp: number;
  iat: number;
  scope: string[];
}

export class UnifiedTokenVerifier {
  private trustedIssuers = new Set<string>();

  trustIssuer(issuer: string): void {
    this.trustedIssuers.add(issuer);
  }

  verify(claims: TokenClaims, now: number = Math.floor(Date.now() / 1000)): {
    valid: boolean;
    reason?: string;
  } {
    if (!this.trustedIssuers.has(claims.iss)) {
      return { valid: false, reason: '미신뢰 발행자' };
    }
    if (claims.exp < now) {
      return { valid: false, reason: '토큰 만료' };
    }
    if (claims.iat > now + 60) {
      return { valid: false, reason: '미래 토큰' };
    }
    return { valid: true };
  }
}

// ============ MTU-N496: Permission Cache ============

export class PermissionCache {
  private cache = new Map<string, { allowed: boolean; expiresAt: number }>();

  set(key: string, allowed: boolean, ttlMs: number): void {
    this.cache.set(key, { allowed, expiresAt: Date.now() + ttlMs });
  }

  get(key: string): boolean | null {
    const entry = this.cache.get(key);
    if (!entry) return null;
    if (entry.expiresAt < Date.now()) {
      this.cache.delete(key);
      return null;
    }
    return entry.allowed;
  }

  invalidate(pattern: string): number {
    let count = 0;
    for (const key of this.cache.keys()) {
      if (key.includes(pattern)) {
        this.cache.delete(key);
        count++;
      }
    }
    return count;
  }
}

// ============ MTU-N497: Audit Event Pipeline ============

export interface AuditEvent {
  eventId: string;
  actor: string;
  action: string;
  target: string;
  timestamp: string;
  ip?: string;
  success: boolean;
}

export class AuditEventPipeline {
  private events: AuditEvent[] = [];
  private subscribers: Array<(event: AuditEvent) => void> = [];

  /**
   * Append-only (CSAP D-06)
   */
  emit(event: AuditEvent): void {
    this.events.push({ ...event });
    for (const sub of this.subscribers) {
      try {
        sub(event);
      } catch {
        // 구독자 오류는 무시 (append는 성공)
      }
    }
  }

  subscribe(handler: (event: AuditEvent) => void): void {
    this.subscribers.push(handler);
  }

  query(filter: { actor?: string; action?: string }): AuditEvent[] {
    return this.events
      .filter((e) => !filter.actor || e.actor === filter.actor)
      .filter((e) => !filter.action || e.action === filter.action)
      .map((e) => ({ ...e }));
  }

  count(): number {
    return this.events.length;
  }
}

// ============ MTU-N498: Metric Aggregator ============

export class MetricAggregator {
  private counters = new Map<string, number>();
  private gauges = new Map<string, number>();
  private histograms = new Map<string, number[]>();

  increment(name: string, value = 1): void {
    this.counters.set(name, (this.counters.get(name) ?? 0) + value);
  }

  setGauge(name: string, value: number): void {
    this.gauges.set(name, value);
  }

  observe(name: string, value: number): void {
    const list = this.histograms.get(name) ?? [];
    list.push(value);
    this.histograms.set(name, list);
  }

  percentile(name: string, p: number): number {
    const list = [...(this.histograms.get(name) ?? [])].sort((a, b) => a - b);
    if (list.length === 0) return 0;
    const idx = Math.floor((list.length - 1) * p);
    return list[idx] ?? 0;
  }

  snapshot(): {
    counters: Record<string, number>;
    gauges: Record<string, number>;
  } {
    return {
      counters: Object.fromEntries(this.counters),
      gauges: Object.fromEntries(this.gauges),
    };
  }
}

// ============ MTU-N499: Unified Log Collector ============

export interface LogEntry {
  level: 'debug' | 'info' | 'warn' | 'error';
  message: string;
  service: string;
  timestamp: string;
  context?: Record<string, unknown>;
}

export class UnifiedLogCollector {
  private buffer: LogEntry[] = [];
  private maxBuffer: number;

  constructor(maxBuffer = 10000) {
    this.maxBuffer = maxBuffer;
  }

  log(entry: LogEntry): void {
    this.buffer.push({ ...entry });
    if (this.buffer.length > this.maxBuffer) {
      this.buffer.shift();
    }
  }

  byLevel(level: LogEntry['level']): LogEntry[] {
    return this.buffer.filter((e) => e.level === level).map((e) => ({ ...e }));
  }

  errorRate(): number {
    if (this.buffer.length === 0) return 0;
    const errors = this.buffer.filter((e) => e.level === 'error').length;
    return errors / this.buffer.length;
  }
}

// ============ MTU-N500: Platform Snapshot ============

export interface PlatformSnapshot {
  takenAt: string;
  health: 'healthy' | 'degraded' | 'unhealthy';
  services: number;
  tenants: number;
  auditEvents: number;
  errorRate: number;
}

export class PlatformSnapshotTaker {
  take(
    health: PlatformHealthIndex,
    discovery: ServiceDiscoveryCache,
    tenants: TenantRoutingTable,
    audit: AuditEventPipeline,
    logs: UnifiedLogCollector,
  ): PlatformSnapshot {
    return {
      takenAt: new Date().toISOString(),
      health: health.overall(),
      services: discovery['cache'].size,
      tenants: tenants['routes'].size,
      auditEvents: audit.count(),
      errorRate: logs.errorRate(),
    };
  }
}
