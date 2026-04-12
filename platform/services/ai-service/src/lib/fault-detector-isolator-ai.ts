// Design Ref: §핵심 알고리즘 — 서킷브레이커 패턴 + 상태 전환
// Plan SC: FR-R219.1~5

enum DataGrade { C = 'C', S = 'S', O = 'O' }

type ServiceState = 'healthy' | 'isolated' | 'recovering';

interface ServiceConfig {
  id: string;
  name: string;
  failureThreshold: number;
  cooldownMs: number;
}

interface ServiceStatus {
  id: string;
  state: ServiceState;
  consecutiveFailures: number;
  lastIsolatedAt: string | null;
  lastHealthyAt: string | null;
}

interface HealthEvent {
  serviceId: string;
  healthy: boolean;
  timestamp: string;
}

interface RecoveryResult {
  serviceId: string;
  canRecover: boolean;
  reason: string;
  newState: ServiceState;
}

interface AuditEntry {
  timestamp: string;
  action: string;
  details: Record<string, unknown>;
}

// Plan SC: FR-R219.5
function guardDataGrade(grade: DataGrade): void {
  if (grade === DataGrade.C || grade === DataGrade.S) {
    throw new Error(`BLOCKED: ${grade}등급 데이터는 AI API 전송 금지 (N2SF N-05)`);
  }
}

export class FaultDetectorIsolatorAI {
  private configs = new Map<string, ServiceConfig>();
  private statuses = new Map<string, ServiceStatus>();
  private healthEvents: HealthEvent[] = [];
  private auditLog: AuditEntry[] = [];

  private log(action: string, details: Record<string, unknown>): void {
    this.auditLog.push({ timestamp: new Date().toISOString(), action, details });
  }

  // Plan SC: FR-R219.1
  registerService(id: string, name: string, failureThreshold: number = 3, cooldownMs: number = 30000): void {
    this.configs.set(id, { id, name, failureThreshold, cooldownMs });
    this.statuses.set(id, {
      id,
      state: 'healthy',
      consecutiveFailures: 0,
      lastIsolatedAt: null,
      lastHealthyAt: new Date().toISOString(),
    });
    this.log('REGISTER_SERVICE', { id, name, failureThreshold, cooldownMs });
  }

  // Plan SC: FR-R219.2
  recordHealthEvent(serviceId: string, healthy: boolean, grade: DataGrade = DataGrade.O): void {
    guardDataGrade(grade);

    const config = this.configs.get(serviceId);
    const status = this.statuses.get(serviceId);
    if (!config || !status) {
      throw new Error(`서비스 미등록: ${serviceId}`);
    }

    const event: HealthEvent = { serviceId, healthy, timestamp: new Date().toISOString() };
    this.healthEvents.push(event);

    if (healthy) {
      status.consecutiveFailures = 0;
      status.lastHealthyAt = event.timestamp;
      if (status.state === 'recovering') {
        status.state = 'healthy';
        this.log('SERVICE_RECOVERED', { serviceId });
      }
    } else {
      status.consecutiveFailures += 1;
      if (status.consecutiveFailures >= config.failureThreshold && status.state === 'healthy') {
        status.state = 'isolated';
        status.lastIsolatedAt = event.timestamp;
        this.log('SERVICE_ISOLATED', { serviceId, consecutiveFailures: status.consecutiveFailures });
      }
    }
  }

  // Plan SC: FR-R219.3
  getServiceStatus(serviceId: string): ServiceStatus {
    const status = this.statuses.get(serviceId);
    if (!status) {
      throw new Error(`서비스 미등록: ${serviceId}`);
    }
    return { ...status };
  }

  // Plan SC: FR-R219.4
  checkRecovery(serviceId: string): RecoveryResult {
    const config = this.configs.get(serviceId);
    const status = this.statuses.get(serviceId);
    if (!config || !status) {
      throw new Error(`서비스 미등록: ${serviceId}`);
    }

    if (status.state !== 'isolated') {
      return { serviceId, canRecover: false, reason: '격리 상태가 아닙니다', newState: status.state };
    }

    const cooldownElapsed = status.lastIsolatedAt
      ? Date.now() - new Date(status.lastIsolatedAt).getTime() >= config.cooldownMs
      : false;

    if (!cooldownElapsed) {
      return { serviceId, canRecover: false, reason: `쿨다운 미경과 (${config.cooldownMs}ms 필요)`, newState: 'isolated' };
    }

    status.state = 'recovering';
    status.consecutiveFailures = 0;
    this.log('SERVICE_RECOVERING', { serviceId });
    return { serviceId, canRecover: true, reason: '쿨다운 경과 — 복구 시작', newState: 'recovering' };
  }

  // Plan SC: FR-R219.5
  getAuditLog(): AuditEntry[] {
    return [...this.auditLog];
  }
}
