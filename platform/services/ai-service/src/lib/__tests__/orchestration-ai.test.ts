import { describe, it, expect, beforeEach } from 'vitest';
import { OrchestrationAi, type CallChain } from '../orchestration-ai';

describe('OrchestrationAi', () => {
  let svc: OrchestrationAi;

  beforeEach(() => {
    svc = new OrchestrationAi();
    svc.registerService({ id: 'auth', name: 'auth', dependencies: [] });
    svc.registerService({ id: 'api', name: 'api', dependencies: ['auth'] });
  });

  it('FR-OR.1 토폴로지', () => {
    expect(svc.getTopology().length).toBe(2);
  });

  it('FR-OR.2 호출 체인', () => {
    const chains: CallChain[] = [
      { traceId: 't1', services: ['api', 'auth'], latencyMs: 100, status: 'ok' },
      { traceId: 't2', services: ['api', 'auth'], latencyMs: 200, status: 'error' },
    ];
    const r = svc.analyzeChain(chains);
    expect(r.avgLatency).toBe(150);
    expect(r.errorRate).toBe(0.5);
  });

  it('FR-OR.3 재시도 정책', () => {
    const p = svc.recommendRetry(0.001, 100);
    expect(p.maxAttempts).toBe(3);
  });

  it('FR-OR.4 부하 분산', () => {
    expect(svc.recommendLoadBalance('api', 10).algorithm).toBe('least-connections');
  });

  it('FR-OR.5 카나리 (점진적)', () => {
    const c = svc.planCanary('api', 'v1', 'v2', 5);
    const next = svc.rollForward(c, 10);
    expect(next.canaryWeight).toBe(15);
  });
});
