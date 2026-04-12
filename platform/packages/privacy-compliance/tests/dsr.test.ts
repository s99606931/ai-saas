// Test Ref: MTU-N458 §dsr
import { describe, it, expect } from 'vitest';
import { DsrWorkflow } from '../src/index.js';

describe('DsrWorkflow — FR-DSR.1/3', () => {
  it('수명주기 received → verified → in_progress → completed', () => {
    const wf = new DsrWorkflow(10);
    const r = wf.receive({ subjectId: 's1', type: 'erasure', actor: 'u1' });
    expect(r.status).toBe('received');
    wf.verifyIdentity(r.id, 'admin');
    wf.start(r.id, 'processor');
    const done = wf.complete(r.id, 'processor', '삭제 완료');
    expect(done.status).toBe('completed');
    expect(done.completedAt).toBeDefined();
  });

  it('잘못된 전이 차단', () => {
    const wf = new DsrWorkflow();
    const r = wf.receive({ subjectId: 's1', type: 'access', actor: 'u1' });
    expect(() => wf.start(r.id, 'p')).toThrow(); // 검증 전 시작 금지
  });

  it('거부 처리 + 사유 기록', () => {
    const wf = new DsrWorkflow();
    const r = wf.receive({ subjectId: 's1', type: 'erasure', actor: 'u1' });
    const rejected = wf.reject(r.id, 'admin', '법적 보관 의무');
    expect(rejected.status).toBe('rejected');
    expect(rejected.rejectionReason).toContain('법적');
  });
});

describe('DsrWorkflow — FR-DSR.4 SLA', () => {
  it('SLA 초과 요청 감지', () => {
    const wf = new DsrWorkflow(0); // 0일 SLA → 즉시 초과
    const r = wf.receive({ subjectId: 's1', type: 'access', actor: 'u1' });
    const overdue = wf.overdueRequests(new Date(Date.now() + 1000));
    expect(overdue.map((x) => x.id)).toContain(r.id);
  });

  it('임박 요청 감지', () => {
    const wf = new DsrWorkflow(1); // 1일
    const r = wf.receive({ subjectId: 's1', type: 'access', actor: 'u1' });
    const upcoming = wf.upcomingDeadlines(48);
    expect(upcoming.map((x) => x.id)).toContain(r.id);
  });
});

describe('DsrWorkflow — FR-DSR.5 감사', () => {
  it('모든 작업 감사 기록 보존', () => {
    const wf = new DsrWorkflow();
    const r = wf.receive({ subjectId: 's1', type: 'portability', actor: 'u1' });
    wf.verifyIdentity(r.id, 'admin');
    wf.start(r.id, 'p');
    wf.complete(r.id, 'p');
    const audit = wf.auditFor(r.id);
    expect(audit.map((a) => a.action)).toEqual([
      'received',
      'identity_verified',
      'started',
      'completed',
    ]);
  });
});
