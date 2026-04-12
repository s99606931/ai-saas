import { describe, it, expect, beforeEach } from 'vitest';
import { AgentRbacEngine, type AccessContext } from '../agent-rbac.js';

describe('AgentRbacEngine', () => {
  let rbac: AgentRbacEngine;

  const baseCtx: AccessContext = {
    agentId: 'agent-1',
    action: 'doc:read',
    resource: 'docs/tenant-a/plan.pdf',
    tenantId: 'tenant-a',
    ipAddress: '10.0.0.5',
    hourOfDay: 10,
    callsToday: 5,
  };

  beforeEach(() => {
    rbac = new AgentRbacEngine();
    rbac.defineRole({
      id: 'role-reader',
      name: '문서 읽기',
      rules: [
        {
          id: 'r1',
          effect: 'allow',
          actions: ['doc:*'],
          resources: ['docs/tenant-a/*'],
          condition: { tenantId: 'tenant-a', maxDailyCalls: 100 },
        },
      ],
    });
  });

  it('역할 미바인딩 시 거부', () => {
    const r = rbac.evaluate(baseCtx);
    expect(r.allowed).toBe(false);
    expect(r.reason).toBe('NO_ROLE_BOUND');
  });

  it('역할 바인딩 후 허용', () => {
    rbac.bind('agent-1', 'role-reader');
    const r = rbac.evaluate(baseCtx);
    expect(r.allowed).toBe(true);
  });

  it('다른 테넌트는 거부', () => {
    rbac.bind('agent-1', 'role-reader');
    const r = rbac.evaluate({ ...baseCtx, tenantId: 'tenant-b' });
    expect(r.allowed).toBe(false);
  });

  it('일일 한도 초과 거부', () => {
    rbac.bind('agent-1', 'role-reader');
    const r = rbac.evaluate({ ...baseCtx, callsToday: 100 });
    expect(r.allowed).toBe(false);
  });

  it('deny 규칙 우선', () => {
    rbac.defineRole({
      id: 'role-deny',
      name: '삭제 금지',
      rules: [{ id: 'd1', effect: 'deny', actions: ['doc:delete'], resources: ['*'] }],
    });
    rbac.bind('agent-1', 'role-reader');
    rbac.bind('agent-1', 'role-deny');
    const r = rbac.evaluate({ ...baseCtx, action: 'doc:delete' });
    expect(r.allowed).toBe(false);
    expect(r.reason).toBe('DENY_RULE');
  });

  it('CIDR 기반 IP 제한', () => {
    rbac.defineRole({
      id: 'role-ip',
      name: '내부망',
      rules: [
        {
          id: 'ip1',
          effect: 'allow',
          actions: ['*'],
          resources: ['*'],
          condition: { ipCidr: '10.0.0.0/24' },
        },
      ],
    });
    rbac.bind('agent-1', 'role-ip');
    expect(rbac.evaluate({ ...baseCtx, ipAddress: '10.0.0.5' }).allowed).toBe(true);
    expect(rbac.evaluate({ ...baseCtx, ipAddress: '192.168.1.1' }).allowed).toBe(false);
  });

  it('감사 로그 기록', () => {
    rbac.bind('agent-1', 'role-reader');
    rbac.evaluate(baseCtx);
    expect(rbac.auditLog().length).toBe(1);
  });
});
