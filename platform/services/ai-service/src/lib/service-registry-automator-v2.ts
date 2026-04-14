// Design Ref: §SVC-AI-ADV-R483 — AI기반 서비스 레지스트리 자동화 v2
// Plan SC: FR-R483.1~5

export type HealthStatus = 'UP' | 'DOWN' | 'DEGRADED';
export type RegistryStatus = 'HEALTHY' | 'DEGRADED' | 'UNHEALTHY';

export interface ServiceEntry {
  readonly serviceId: string;
  readonly name: string;
  readonly version: string;
  readonly endpoint: string;
  readonly healthCheckUrl: string;
}

export interface ServiceHealth {
  readonly serviceId: string;
  readonly status: HealthStatus;
  readonly responseMs: number;
  readonly registryStatus: RegistryStatus;
}

export interface RegistrySnapshot {
  readonly total: number;
  readonly healthy: number;
  readonly unhealthy: number;
  readonly services: readonly ServiceHealth[];
}

interface AuditEvent {
  timestamp: string;
  action: string;
  details: Record<string, unknown>;
}

export class ServiceRegistryAutomatorV2 {
  private readonly registry = new Map<string, ServiceEntry>();
  private readonly auditLog: AuditEvent[] = [];

  register(entry: ServiceEntry): void {
    this.registry.set(entry.serviceId, entry);
    this.auditLog.push({
      timestamp: new Date().toISOString(),
      action: 'registry.register',
      details: { serviceId: entry.serviceId, name: entry.name, version: entry.version },
    });
  }

  private classifyRegistryStatus(status: HealthStatus, responseMs: number): RegistryStatus {
    if (status === 'DOWN' || responseMs > 5000) return 'UNHEALTHY';
    if (status === 'DEGRADED') return 'DEGRADED';
    return 'HEALTHY';
  }

  updateHealth(
    healthUpdates: readonly { serviceId: string; status: HealthStatus; responseMs: number }[]
  ): RegistrySnapshot {
    const services: ServiceHealth[] = healthUpdates.map(h => ({
      serviceId: h.serviceId,
      status: h.status,
      responseMs: h.responseMs,
      registryStatus: this.classifyRegistryStatus(h.status, h.responseMs),
    }));

    const healthy = services.filter(s => s.registryStatus === 'HEALTHY').length;
    const unhealthy = services.filter(s => s.registryStatus === 'UNHEALTHY').length;

    this.auditLog.push({
      timestamp: new Date().toISOString(),
      action: 'registry.healthUpdate',
      details: {
        total: services.length,
        healthy,
        unhealthy,
        degraded: services.filter(s => s.registryStatus === 'DEGRADED').length,
      },
    });

    return { total: services.length, healthy, unhealthy, services };
  }

  getSnapshot(): readonly ServiceEntry[] {
    return [...this.registry.values()];
  }

  getAuditLog(): readonly AuditEvent[] {
    return [...this.auditLog];
  }
}
