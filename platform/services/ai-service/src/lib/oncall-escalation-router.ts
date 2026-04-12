// Design Ref: docs/02-design/mtus/SVC-AI-ADV-R89.design.md
// Plan SC: FR-R89.1~5 (SVC-AI-ADV-R89 Oncall Escalation Router)
// CSAP: D-06 감사

export type Severity = 'critical' | 'high' | 'medium' | 'low';

export interface Responder {
  id: string;
  domains: string[];
  level: 1 | 2 | 3;
  fatigue: number;
  available: boolean;
}

export interface Incident {
  id: string;
  severity: Severity;
  domain: string;
  summary?: string;
}

export interface RouteResult {
  incidentId: string;
  primary: Responder | null;
  chain: Responder[];
  skipped: Array<{ id: string; reason: string }>;
}

export interface AuditEvent {
  ts: string;
  action: 'REGISTER' | 'ROUTE' | 'ESCALATE' | 'SKIPPED_FATIGUE' | 'NO_RESPONDER';
  details: Record<string, unknown>;
}

const FATIGUE_LIMIT = 0.8;

const SEVERITY_LEVEL_MAP: Record<Severity, Array<1 | 2 | 3>> = {
  critical: [1],
  high: [1, 2],
  medium: [2, 3],
  low: [3],
};

export class OncallEscalationRouter {
  private readonly responders = new Map<string, Responder>();
  private readonly auditLog: AuditEvent[] = [];
  private readonly routes = new Map<string, RouteResult>();

  /** FR-R89.1 */
  register(responder: Responder): void {
    if (!responder.id || !Array.isArray(responder.domains)) {
      throw new Error('invalid responder');
    }
    if (responder.fatigue < 0 || responder.fatigue > 1) {
      throw new Error('fatigue must be in [0,1]');
    }
    this.responders.set(responder.id, { ...responder, domains: [...responder.domains] });
    this.log('REGISTER', { id: responder.id, level: responder.level });
  }

  /** FR-R89.2~4 */
  route(incident: Incident): RouteResult {
    const allowedLevels = SEVERITY_LEVEL_MAP[incident.severity];
    const candidates: Responder[] = [];
    const skipped: Array<{ id: string; reason: string }> = [];

    this.responders.forEach((r) => {
      if (!r.available) {
        skipped.push({ id: r.id, reason: 'unavailable' });
        return;
      }
      if (!r.domains.includes(incident.domain)) {
        return; // 도메인 불일치는 skipped에 넣지 않음 (대상 아님)
      }
      if (!allowedLevels.includes(r.level)) {
        return;
      }
      if (r.fatigue > FATIGUE_LIMIT) {
        skipped.push({ id: r.id, reason: 'high_fatigue' });
        this.log('SKIPPED_FATIGUE', { id: r.id, fatigue: r.fatigue });
        return;
      }
      candidates.push(r);
    });

    candidates.sort((a, b) => {
      if (a.level !== b.level) return a.level - b.level; // 낮은 레벨(=높은 우선순위)
      return a.fatigue - b.fatigue;
    });

    const primary = candidates[0] ?? null;
    const chain = candidates.slice(1);

    const result: RouteResult = {
      incidentId: incident.id,
      primary,
      chain,
      skipped,
    };
    this.routes.set(incident.id, result);

    if (primary) {
      this.log('ROUTE', {
        incidentId: incident.id,
        primary: primary.id,
        chainLen: chain.length,
      });
    } else {
      this.log('NO_RESPONDER', {
        incidentId: incident.id,
        severity: incident.severity,
        domain: incident.domain,
      });
    }
    return result;
  }

  /** 응답없음 시 체인의 다음 담당자 선택 */
  nextInChain(incidentId: string): Responder | null {
    const route = this.routes.get(incidentId);
    if (!route) return null;
    const next = route.chain.shift() ?? null;
    if (next) {
      // primary를 next로 업데이트
      const updated: RouteResult = {
        ...route,
        primary: next,
        chain: route.chain,
      };
      this.routes.set(incidentId, updated);
      this.log('ESCALATE', { incidentId, next: next.id });
    }
    return next;
  }

  /** 피로도 증가 (알림 1회당) */
  addFatigue(responderId: string, delta: number): void {
    const r = this.responders.get(responderId);
    if (!r) return;
    r.fatigue = Math.min(1, r.fatigue + delta);
  }

  /** FR-R89.5 */
  getAuditLog(): readonly AuditEvent[] {
    return this.auditLog.slice();
  }

  private log(action: AuditEvent['action'], details: Record<string, unknown>): void {
    this.auditLog.push({ ts: new Date().toISOString(), action, details });
  }
}

export function createOncallEscalationRouter(): OncallEscalationRouter {
  return new OncallEscalationRouter();
}
