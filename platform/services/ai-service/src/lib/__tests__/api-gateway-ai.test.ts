import { describe, it, expect } from 'vitest';
import { ApiGatewayAi, type ApiRequest } from '../api-gateway-ai';

describe('ApiGatewayAi', () => {
  const svc = new ApiGatewayAi();

  it('FR-AGW.1 요청 분류', () => {
    expect(svc.classify({ method: 'POST', path: '/api/users' })).toBe('write');
    expect(svc.classify({ method: 'GET', path: '/api/report/daily' })).toBe('expensive');
    expect(svc.classify({ method: 'POST', path: '/auth/login' })).toBe('auth');
  });

  it('FR-AGW.2 Rate Limit', () => {
    const r = svc.computeRateLimit('read', 900);
    expect(r.limitPerSec).toBeLessThan(1000);
  });

  it('FR-AGW.3 우선순위', () => {
    const t = svc.assignPriority('auth', 'admin-x');
    expect(t.priority).toBeGreaterThanOrEqual(90);
  });

  it('FR-AGW.4 공격 차단', () => {
    const sqli = svc.checkAttack("'; DROP TABLE users; --");
    expect(sqli.length).toBeGreaterThan(0);
    const clean = svc.checkAttack('normal text');
    expect(clean.length).toBe(0);
  });

  it('FR-AGW.5 메트릭', () => {
    const gw = new ApiGatewayAi();
    const req: ApiRequest = { method: 'GET', path: '/api/users' };
    gw.record(req);
    gw.record(req, true);
    const m = gw.getMetric();
    expect(m.totalRequests).toBe(2);
    expect(m.blocked).toBe(1);
  });
});
