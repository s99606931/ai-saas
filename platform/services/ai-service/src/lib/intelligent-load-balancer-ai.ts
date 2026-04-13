// Design Ref: §핵심 알고리즘 — effectiveWeight 기반 지능형 라우팅
// Plan SC: FR-R263.1~5

enum DataGrade { C = 'C', S = 'S', O = 'O' }

interface ServerConfig {
  id: string;
  name: string;
  weight: number;
  maxConnections: number;
}

interface ServerStatus {
  id: string;
  healthy: boolean;
  responseTimeMs: number;
  activeConnections: number;
  effectiveWeight: number;
}

interface RouteDecision {
  selectedServerId: string;
  serverName: string;
  effectiveWeight: number;
  reason: string;
}

interface AuditEntry {
  timestamp: string;
  action: string;
  details: Record<string, unknown>;
}

// Plan SC: FR-R263.5
function guardDataGrade(grade: DataGrade): void {
  if (grade === DataGrade.C || grade === DataGrade.S) {
    throw new Error(`BLOCKED: ${grade}등급 데이터는 AI API 전송 금지 (N2SF N-05)`);
  }
}

export class IntelligentLoadBalancerAI {
  private servers = new Map<string, ServerConfig>();
  private statuses = new Map<string, ServerStatus>();
  private auditLog: AuditEntry[] = [];

  private log(action: string, details: Record<string, unknown>): void {
    this.auditLog.push({ timestamp: new Date().toISOString(), action, details });
  }

  // Plan SC: FR-R263.1
  registerServer(id: string, name: string, initialWeight: number = 100, maxConnections: number = 1000): void {
    this.servers.set(id, { id, name, weight: initialWeight, maxConnections });
    this.statuses.set(id, { id, healthy: true, responseTimeMs: 0, activeConnections: 0, effectiveWeight: initialWeight });
    this.log('REGISTER_SERVER', { id, name, initialWeight, maxConnections });
  }

  // Plan SC: FR-R263.2
  updateServerStatus(serverId: string, responseTimeMs: number, activeConnections: number, healthy: boolean): void {
    const config = this.servers.get(serverId);
    const status = this.statuses.get(serverId);
    if (!config || !status) throw new Error(`서버 미등록: ${serverId}`);

    status.healthy = healthy;
    status.responseTimeMs = responseTimeMs;
    status.activeConnections = activeConnections;

    if (!healthy) {
      status.effectiveWeight = 0;
    } else {
      const connectionRatio = Math.min(1, activeConnections / config.maxConnections);
      status.effectiveWeight = Math.round(config.weight * (1 - connectionRatio));
    }

    this.log('UPDATE_SERVER_STATUS', { serverId, responseTimeMs, activeConnections, healthy, effectiveWeight: status.effectiveWeight });
  }

  // Plan SC: FR-R263.3
  route(grade: DataGrade = DataGrade.O): RouteDecision {
    guardDataGrade(grade);

    const healthyServers = Array.from(this.statuses.values()).filter(s => s.healthy && s.effectiveWeight > 0);
    if (healthyServers.length === 0) {
      throw new Error('사용 가능한 건강한 서버 없음');
    }

    const best = healthyServers.reduce((a, b) => a.effectiveWeight >= b.effectiveWeight ? a : b);
    const serverConfig = this.servers.get(best.id)!;

    this.log('ROUTE', { selectedServerId: best.id, effectiveWeight: best.effectiveWeight });
    return {
      selectedServerId: best.id,
      serverName: serverConfig.name,
      effectiveWeight: best.effectiveWeight,
      reason: `effectiveWeight 최대 (${best.effectiveWeight})`,
    };
  }

  // Plan SC: FR-R263.4
  adjustWeights(): void {
    const healthyStatuses = Array.from(this.statuses.values()).filter(s => s.healthy);
    if (healthyStatuses.length === 0) return;

    const avgResponseTime = healthyStatuses.reduce((s, v) => s + v.responseTimeMs, 0) / healthyStatuses.length;

    for (const status of healthyStatuses) {
      const config = this.servers.get(status.id)!;
      if (status.responseTimeMs < avgResponseTime * 0.8) {
        config.weight = Math.min(200, config.weight + 10);
      } else if (status.responseTimeMs > avgResponseTime * 1.2) {
        config.weight = Math.max(10, config.weight - 10);
      }
    }

    this.log('ADJUST_WEIGHTS', { serverCount: healthyStatuses.length });
  }

  getServerStatuses(): ServerStatus[] {
    return Array.from(this.statuses.values());
  }

  // Plan SC: FR-R263.5
  getAuditLog(): AuditEntry[] {
    return [...this.auditLog];
  }
}
