/**
 * DSR 프로세서 테스트
 * Plan SC: FR-DSR.1~5
 */

import { DsrProcessor } from '../src/dsr-processor';

describe('DsrProcessor', () => {
  let proc: DsrProcessor;
  beforeEach(() => {
    proc = new DsrProcessor();
  });

  it('receive: 요청 접수 + dueDate 10일 후 + 감사로그', () => {
    const req = proc.receive({
      requestId: 'r1',
      subjectId: 's1',
      type: 'access',
      actor: 'system',
    });
    expect(req.status).toBe('received');
    const audit = proc.getAudit('r1');
    expect(audit[0]?.action).toBe('RECEIVED');
    const days = (new Date(req.dueDate).getTime() - new Date(req.receivedAt).getTime()) / (86400 * 1000);
    expect(days).toBeCloseTo(10, 0);
  });

  it('verify: 신원 확인 후 processing 상태', () => {
    proc.receive({
      requestId: 'r1',
      subjectId: 's1',
      type: 'erase',
      actor: 'system',
    });
    const verified = proc.verify('r1', 'admin');
    expect(verified.verifiedAt).not.toBeNull();
    expect(verified.status).toBe('processing');
  });

  it('verify: 미존재 요청 시 오류', () => {
    expect(() => proc.verify('nope', 'admin')).toThrow(/요청 없음/);
  });

  it('complete: 처리 완료 + 감사로그', () => {
    proc.receive({
      requestId: 'r1',
      subjectId: 's1',
      type: 'rectify',
      actor: 'system',
    });
    proc.complete('r1', 'admin', '수정 완료');
    const audit = proc.getAudit('r1');
    expect(audit.find((a) => a.action === 'COMPLETED')).toBeDefined();
    expect(proc.get('r1')?.status).toBe('completed');
  });

  it('complete: 미존재 요청 시 오류', () => {
    expect(() => proc.complete('nope', 'admin')).toThrow(/요청 없음/);
  });

  it('findOverdue: 마감일 지난 미완료 요청 식별', () => {
    proc.receive({
      requestId: 'r1',
      subjectId: 's1',
      type: 'access',
      actor: 'system',
    });
    const future = new Date(Date.now() + 1000 * 60 * 60 * 24 * 30);
    const overdue = proc.findOverdue(future);
    expect(overdue.length).toBe(1);
    expect(overdue[0]?.requestId).toBe('r1');
  });

  it('findOverdue: 완료된 요청은 제외', () => {
    proc.receive({
      requestId: 'r1',
      subjectId: 's1',
      type: 'access',
      actor: 'system',
    });
    proc.complete('r1', 'admin');
    const future = new Date(Date.now() + 1000 * 60 * 60 * 24 * 30);
    expect(proc.findOverdue(future).length).toBe(0);
  });

  it('getAudit 전체 조회', () => {
    proc.receive({
      requestId: 'r1',
      subjectId: 's1',
      type: 'access',
      actor: 'system',
    });
    proc.receive({
      requestId: 'r2',
      subjectId: 's2',
      type: 'port',
      actor: 'system',
    });
    expect(proc.getAudit().length).toBe(2);
  });

  it('get: 미존재 요청은 undefined', () => {
    expect(proc.get('nope')).toBeUndefined();
  });
});
