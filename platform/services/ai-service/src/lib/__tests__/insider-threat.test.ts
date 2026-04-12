import { describe, it, expect, beforeEach } from 'vitest';
import { InsiderThreat, type UserActivity } from '../insider-threat';

describe('InsiderThreat', () => {
  let svc: InsiderThreat;

  beforeEach(() => {
    svc = new InsiderThreat();
    const baseline: UserActivity[] = Array.from({ length: 20 }, (_, i) => ({
      userId: 'u1',
      action: 'read',
      resource: 'doc-a',
      bytesTransferred: 1000,
      timestamp: '',
      hour: 10 + (i % 3),
    }));
    svc.learnBaseline(baseline);
  });

  it('FR-IT.1 베이스라인 학습', () => {
    const b = svc.learnBaseline([{ userId: 'u2', action: 'r', resource: 'x', timestamp: '', hour: 9 }]);
    expect(b[0]!.userId).toBe('u2');
  });

  it('FR-IT.2 UEBA 이상 점수', () => {
    const recent: UserActivity[] = Array.from({ length: 50 }, (_, i) => ({
      userId: 'u1',
      action: 'read',
      resource: `new-res-${i}`,
      timestamp: '',
      hour: 3,
    }));
    const score = svc.scoreUeba('u1', recent);
    expect(score.score).toBeGreaterThan(30);
  });

  it('FR-IT.3 권한 남용', () => {
    const acts: UserActivity[] = [{ userId: 'u1', action: 'delete', resource: 'hr-db', timestamp: '', hour: 2 }];
    const a = svc.detectPrivilegeAbuse(acts, new Set(['hr-db']));
    expect(a).toContain('u1');
  });

  it('FR-IT.4 데이터 반출', () => {
    const acts: UserActivity[] = [{ userId: 'u1', action: 'download', resource: 'db', bytesTransferred: 200 * 1024 * 1024, timestamp: '', hour: 3 }];
    const p = svc.detectExfiltration(acts, 100);
    expect(p[0]!.suspicious).toBe(true);
  });

  it('FR-IT.5 경보 라우팅', () => {
    const alert = svc.route({ userId: 'u1', score: 60, reasons: [] });
    expect(alert.severity).toBe('critical');
  });
});
