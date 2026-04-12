// Design Ref: MTU-N485 §API 게이트웨이 AI
// Plan SC: FR-AGW.1~5

export type RequestClass = 'read' | 'write' | 'expensive' | 'auth';

export interface ApiRequest {
  method: string;
  path: string;
  userId?: string;
  bodySize?: number;
}

export interface RateLimitPolicy {
  userId?: string;
  class: RequestClass;
  limitPerSec: number;
}

export interface PriorityTicket {
  requestId: string;
  priority: number;
}

export interface AttackSignature {
  name: string;
  pattern: RegExp;
  block: boolean;
}

export interface GatewayMetric {
  totalRequests: number;
  byClass: Record<RequestClass, number>;
  blocked: number;
}

export class ApiGatewayAi {
  private signatures: AttackSignature[] = [
    { name: 'SQLi', pattern: /('|;|--|UNION\s+SELECT)/i, block: true },
    { name: 'XSS', pattern: /<script|javascript:/i, block: true },
    { name: 'PathTraversal', pattern: /\.\.\//, block: true },
  ];
  private metric: GatewayMetric = {
    totalRequests: 0,
    byClass: { read: 0, write: 0, expensive: 0, auth: 0 },
    blocked: 0,
  };

  /** FR-AGW.1 요청 분류 */
  classify(req: ApiRequest): RequestClass {
    if (req.path.includes('/auth') || req.path.includes('/login')) return 'auth';
    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) return 'write';
    if (req.path.includes('/report') || req.path.includes('/aggregate')) return 'expensive';
    return 'read';
  }

  /** FR-AGW.2 동적 Rate Limit */
  computeRateLimit(cls: RequestClass, currentRps: number): RateLimitPolicy {
    const baseLimits: Record<RequestClass, number> = { read: 1000, write: 200, expensive: 20, auth: 50 };
    const base = baseLimits[cls];
    const adjusted = currentRps > base * 0.8 ? Math.floor(base * 0.5) : base;
    return { class: cls, limitPerSec: adjusted };
  }

  /** FR-AGW.3 우선순위 큐 */
  assignPriority(cls: RequestClass, userId?: string): PriorityTicket {
    const base: Record<RequestClass, number> = { auth: 90, write: 70, read: 50, expensive: 20 };
    const bonus = userId?.startsWith('admin') ? 10 : 0;
    return { requestId: `req-${Date.now()}`, priority: base[cls] + bonus };
  }

  /** FR-AGW.4 공격 패턴 차단 */
  checkAttack(payload: string): AttackSignature[] {
    return this.signatures.filter((s) => s.pattern.test(payload));
  }

  /** FR-AGW.5 메트릭 */
  record(req: ApiRequest, blocked = false): void {
    this.metric.totalRequests++;
    const cls = this.classify(req);
    this.metric.byClass[cls]++;
    if (blocked) this.metric.blocked++;
  }

  getMetric(): GatewayMetric {
    return { ...this.metric, byClass: { ...this.metric.byClass } };
  }
}

export const apiGatewayAi = new ApiGatewayAi();
