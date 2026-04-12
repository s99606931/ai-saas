import { describe, it, expect, beforeEach } from 'vitest';
import { DataSubjectRights } from '../data-subject-rights';

describe('DataSubjectRights', () => {
  let svc: DataSubjectRights;

  beforeEach(() => {
    svc = new DataSubjectRights();
  });

  it('FR-DSR.1 접수 및 10일 기한 설정', () => {
    const r = svc.receive('r1', 's1', 'access', new Date('2026-04-11'));
    expect(r.status).toBe('received');
    expect(r.deadlineAt.startsWith('2026-04-21')).toBe(true);
  });

  it('FR-DSR.1 신원 확인', () => {
    svc.receive('r2', 's1', 'delete', new Date('2026-04-11'));
    const r = svc.verifyIdentity('r2', 'admin');
    expect(r.identityVerified).toBe(true);
  });

  it('FR-DSR.2/3 워크플로우 (신원 필요)', () => {
    svc.receive('r3', 's1', 'port', new Date('2026-04-11'));
    expect(() => svc.startProcessing('r3', 'admin')).toThrow();
    svc.verifyIdentity('r3', 'admin');
    const r = svc.startProcessing('r3', 'admin');
    expect(r.status).toBe('processing');
    const done = svc.complete('r3', 'admin');
    expect(done.status).toBe('completed');
  });

  it('FR-DSR.4 SLA (기한 내)', () => {
    svc.receive('r4', 's1', 'access', new Date('2026-04-11'));
    const sla = svc.checkSla('r4', new Date('2026-04-15'));
    expect(sla.overdue).toBe(false);
    expect(sla.daysRemaining).toBeGreaterThan(0);
  });

  it('FR-DSR.4 SLA (초과)', () => {
    svc.receive('r5', 's1', 'access', new Date('2026-04-01'));
    const sla = svc.checkSla('r5', new Date('2026-04-20'));
    expect(sla.overdue).toBe(true);
  });

  it('FR-DSR.5 감사 로그', () => {
    svc.receive('r6', 's1', 'access', new Date('2026-04-11'));
    svc.verifyIdentity('r6', 'admin');
    const log = svc.getAuditLog('r6');
    expect(log.length).toBe(2);
  });
});
