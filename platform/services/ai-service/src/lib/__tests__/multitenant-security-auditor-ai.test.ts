import { describe, it, expect, beforeEach } from 'vitest';
import { MultitenantSecurityAuditorAI } from '../multitenant-security-auditor-ai';

describe('MultitenantSecurityAuditorAI', () => {
  let auditor: MultitenantSecurityAuditorAI;

  beforeEach(() => {
    auditor = new MultitenantSecurityAuditorAI();
  });

  it('테넌트를 등록한다', () => {
    auditor.registerTenant('t1', '기관A', 'standard');
    expect(auditor.getAuditLog().some(l => l.action === 'REGISTER_TENANT')).toBe(true);
  });

  it('보안 이벤트를 기록하고 ID를 반환한다', () => {
    auditor.registerTenant('t1', '기관A', 'standard');
    const event = auditor.recordSecurityEvent('t1', 'LOGIN_FAIL', 'low');
    expect(event.id).toBeDefined();
    expect(event.tenantId).toBe('t1');
  });

  it('이벤트 없으면 보안 점수는 100이다', () => {
    auditor.registerTenant('t1', '기관A', 'standard');
    expect(auditor.getSecurityScore('t1')).toBe(100);
  });

  it('critical 이벤트로 점수가 감소한다', () => {
    auditor.registerTenant('t1', '기관A', 'standard');
    auditor.recordSecurityEvent('t1', 'BREACH', 'critical');
    expect(auditor.getSecurityScore('t1')).toBe(80);
  });

  it('격리 위반을 탐지한다', () => {
    auditor.registerTenant('t1', '기관A', 'standard');
    auditor.registerTenant('t2', '기관B', 'standard');
    auditor.recordSecurityEvent('t1', 'CROSS_ACCESS', 'high', 't2');
    const violations = auditor.getIsolationViolations();
    expect(violations.length).toBe(1);
    expect(violations[0]!.sourceTenantId).toBe('t1');
    expect(violations[0]!.targetTenantId).toBe('t2');
  });

  it('C등급 이벤트 기록을 차단한다', () => {
    auditor.registerTenant('t1', '기관A', 'standard');
    expect(() => auditor.recordSecurityEvent('t1', 'TEST', 'low', undefined, 'C' as never)).toThrow('BLOCKED');
  });

  it('미등록 테넌트 이벤트 기록 시 오류를 던진다', () => {
    expect(() => auditor.recordSecurityEvent('unknown', 'TEST', 'low')).toThrow('테넌트 미등록');
  });
});
