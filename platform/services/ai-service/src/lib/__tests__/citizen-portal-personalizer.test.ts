import { describe, it, expect } from 'vitest';
import { CitizenPortalPersonalizer } from '../citizen-portal-personalizer.js';

describe('SVC-AI-ADV-R356 CitizenPortalPersonalizer', () => {
  const now = 1_000_000_000_000;
  const dayMs = 24 * 60 * 60 * 1000;

  it('FR-356.1: Top-N 추천', () => {
    const svc = new CitizenPortalPersonalizer();
    svc.recordUsage({ userId: 'u1', serviceId: 'tax', timestamp: now });
    svc.recordUsage({ userId: 'u1', serviceId: 'tax', timestamp: now });
    svc.recordUsage({ userId: 'u1', serviceId: 'passport', timestamp: now });
    const recs = svc.recommend('u1', 2, now);
    expect(recs.length).toBe(2);
    expect(recs[0]?.serviceId).toBe('tax');
  });

  it('FR-356.2: 시간 가중치', () => {
    const svc = new CitizenPortalPersonalizer(1.0);
    svc.recordUsage({ userId: 'u1', serviceId: 'old', timestamp: now - 10 * dayMs });
    svc.recordUsage({ userId: 'u1', serviceId: 'new', timestamp: now });
    const recs = svc.recommend('u1', 2, now);
    expect(recs[0]?.serviceId).toBe('new');
  });

  it('FR-356.3: C/S 차단', () => {
    const svc = new CitizenPortalPersonalizer();
    expect(() =>
      svc.recordUsage({ userId: 'u1', serviceId: 's', timestamp: now }, 'S'),
    ).toThrow('N2SF_BLOCKED');
  });

  it('FR-356.4: 감사 로그', () => {
    const svc = new CitizenPortalPersonalizer();
    svc.recordUsage({ userId: 'u1', serviceId: 's', timestamp: now });
    svc.recommend('u1', 1, now);
    expect(svc.getAuditLog().length).toBe(2);
  });

  it('사용 기록 없으면 빈 배열', () => {
    const svc = new CitizenPortalPersonalizer();
    expect(svc.recommend('unknown', 5, now).length).toBe(0);
  });
});
