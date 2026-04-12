import { describe, it, expect } from 'vitest';
import { AgentAuditTrail } from '../agent-audit-trail.js';

describe('AgentAuditTrail', () => {
  it('append 후 무결성 검증 성공', () => {
    const trail = new AgentAuditTrail();
    trail.append({ agentId: 'a1', actorId: 'u1', action: 'execute', resource: '/task/1', details: { ok: true } });
    trail.append({ agentId: 'a1', actorId: 'u1', action: 'tool_call', resource: 'tool:x', details: {} });
    expect(trail.verifyIntegrity().valid).toBe(true);
    expect(trail.size()).toBe(2);
  });

  it('체인 해시 연결', () => {
    const trail = new AgentAuditTrail();
    const e1 = trail.append({ agentId: 'a1', actorId: 'u1', action: 'read', resource: '/x', details: {} });
    const e2 = trail.append({ agentId: 'a1', actorId: 'u1', action: 'write', resource: '/y', details: {} });
    expect(e2.prevHash).toBe(e1.hash);
  });

  it('쿼리 필터링', () => {
    const trail = new AgentAuditTrail();
    trail.append({ agentId: 'a1', actorId: 'u1', action: 'execute', resource: '/', details: {} });
    trail.append({ agentId: 'a2', actorId: 'u1', action: 'execute', resource: '/', details: {} });
    expect(trail.query({ agentId: 'a1' })).toHaveLength(1);
  });

  it('변조 탐지', () => {
    const trail = new AgentAuditTrail();
    trail.append({ agentId: 'a1', actorId: 'u1', action: 'read', resource: '/', details: {} });
    trail.append({ agentId: 'a1', actorId: 'u1', action: 'write', resource: '/', details: {} });
    // 내부 변조 시뮬레이션: 쿼리 결과는 읽기 전용이므로 강제 캐스팅
    const internal = (trail as unknown as { entries: Array<{ details: Record<string, unknown> }> }).entries;
    const first = internal[0];
    if (first) first.details = { hacked: true };
    const result = trail.verifyIntegrity();
    expect(result.valid).toBe(false);
  });

  it('보존 기간 초과 아카이브', () => {
    const trail = new AgentAuditTrail(1);
    trail.append({ agentId: 'a1', actorId: 'u1', action: 'read', resource: '/', details: {} });
    const future = new Date(Date.now() + 2 * 86400000);
    const archived = trail.archiveExpired(future);
    expect(archived.length).toBe(1);
    expect(trail.size()).toBe(0);
  });
});
