// MTU-N351 IP 평판 검사 테스트
import { describe, it, expect } from 'vitest';
import { IPReputationCheckerService } from '../ip-reputation-checker.js';

describe('MTU-N351 IPReputationChecker', () => {
  const svc = new IPReputationCheckerService('tenant-n351');

  it('FR-N351.1: 평판 업데이트', () => {
    const rep = svc.update('1.2.3.4', 80, ['malware']);
    expect(rep).toBeDefined();
  });

  it('FR-N351.2: 평판 조회', () => {
    svc.update('5.6.7.8', 20, []);
    const found = svc.lookup('5.6.7.8');
    expect(found).toBeDefined();
  });

  it('FR-N351.3: 접근 평가', () => {
    svc.update('9.8.7.6', 90, ['botnet']);
    const decision = svc.evaluate('9.8.7.6');
    expect(decision).toBeDefined();
  });

  it('FR-N351.4: 일괄 업데이트', () => {
    const reps = svc.bulkUpdate([
      { ip: '1.1.1.1', score: 10, threats: [] },
      { ip: '2.2.2.2', score: 50, threats: ['spam'] },
    ]);
    expect(reps.length).toBe(2);
  });

  it('FR-N351.6: 감사 로그', () => {
    expect(svc.getAuditLog().length).toBeGreaterThan(0);
  });
});
