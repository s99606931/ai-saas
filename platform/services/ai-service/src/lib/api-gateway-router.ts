// API 게이트웨이 라우팅 관리 -- FR-N348.1~FR-N348.4
// Design Ref: MTU-N348 | CSAP: D-06, D-08

export interface RouteRule { readonly ruleId: string; readonly tenantId: string; readonly method: string; readonly pathPattern: string; readonly upstream: string; readonly requireAuth: boolean; readonly headers: Record<string, string>; readonly priority: number; }
export interface RouteMatch { readonly ruleId: string; readonly upstream: string; readonly params: Record<string, string>; readonly headers: Record<string, string>; }
export interface GatewayAuditEntry { readonly timestamp: string; readonly actor: string; readonly tenantId: string; readonly action: string; readonly target: string; readonly details: Record<string, unknown>; }

const auditLog: GatewayAuditEntry[] = [];
function recordAudit(entry: Omit<GatewayAuditEntry, 'timestamp'>): void { auditLog.push({ ...entry, timestamp: new Date().toISOString() }); }
export function getGatewayAuditLog(tenantId: string): readonly GatewayAuditEntry[] { return auditLog.filter(e => e.tenantId === tenantId); }

const routeStore: Map<string, RouteRule[]> = new Map();

export function registerRoute(tenantId: string, method: string, pathPattern: string, upstream: string, requireAuth: boolean = true, headers: Record<string, string> = {}, priority: number = 0): RouteRule {
  const rule: RouteRule = { ruleId: `rt-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, tenantId, method: method.toUpperCase(), pathPattern, upstream, requireAuth, headers, priority };
  const existing = routeStore.get(tenantId) ?? [];
  existing.push(rule);
  existing.sort((a, b) => b.priority - a.priority);
  routeStore.set(tenantId, existing);
  recordAudit({ actor: 'system', tenantId, action: 'ROUTE_REGISTERED', target: rule.ruleId, details: { method, pathPattern, upstream } });
  return rule;
}

export function matchRoute(tenantId: string, method: string, path: string): RouteMatch | null {
  const routes = routeStore.get(tenantId) ?? [];
  for (const rule of routes) {
    if (rule.method !== '*' && rule.method !== method.toUpperCase()) continue;
    const pattern = rule.pathPattern.replace(/\{(\w+)\}/g, '(?<$1>[^/]+)');
    const regex = new RegExp(`^${pattern}$`);
    const match = regex.exec(path);
    if (match) {
      return { ruleId: rule.ruleId, upstream: rule.upstream, params: match.groups ?? {}, headers: rule.headers };
    }
  }
  return null;
}

export function getRoutes(tenantId: string): readonly RouteRule[] { return routeStore.get(tenantId) ?? []; }

export function validateAuth(rule: RouteRule, token: string | null): { allowed: boolean; reason: string } {
  if (!rule.requireAuth) return { allowed: true, reason: '인증 불필요' };
  if (!token) return { allowed: false, reason: '인증 토큰 누락' };
  if (token.length < 10) return { allowed: false, reason: '유효하지 않은 토큰' };
  return { allowed: true, reason: '인증 통과' };
}

export class ApiGatewayRouterService {
  constructor(private readonly tenantId: string) {}
  register(method: string, path: string, upstream: string, auth?: boolean, headers?: Record<string, string>, priority?: number): RouteRule { return registerRoute(this.tenantId, method, path, upstream, auth, headers, priority); }
  match(method: string, path: string): RouteMatch | null { return matchRoute(this.tenantId, method, path); }
  routes(): readonly RouteRule[] { return getRoutes(this.tenantId); }
  getAuditLog(): readonly GatewayAuditEntry[] { return getGatewayAuditLog(this.tenantId); }
}
