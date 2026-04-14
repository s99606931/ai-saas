import { describe, it, expect, beforeEach } from 'vitest';
import { CitizenServicePersonalizerV4 } from '../citizen-service-personalizer-v4';

describe('CitizenServicePersonalizerV4', () => {
  let p: CitizenServicePersonalizerV4;

  beforeEach(() => {
    p = new CitizenServicePersonalizerV4();
    p.registerService({ serviceId: 'childcare', tags: ['child', 'welfare'] });
    p.registerService({ serviceId: 'health', tags: ['health', 'welfare'] });
    p.registerService({ serviceId: 'employment', tags: ['job'] });
    p.upsertProfile({ citizenId: '900101-1234567', interestTags: ['child', 'welfare'] });
  });

  it('FR-R704.3: recommends by tag overlap', () => {
    const recs = p.recommend('900101-1234567', 3);
    expect(recs[0]!.serviceId).toBe('childcare');
    expect(recs[0]!.score).toBe(2);
  });

  it('FR-R704.4: LIKE boosts score, DISLIKE removes', () => {
    p.recordFeedback('900101-1234567', 'health', 'LIKE');
    p.recordFeedback('900101-1234567', 'childcare', 'DISLIKE');
    const recs = p.recommend('900101-1234567', 3);
    expect(recs.find((r) => r.serviceId === 'childcare')).toBeUndefined();
    expect(recs[0]!.serviceId).toBe('health');
  });

  it('FR-R704.2: blocks C/S grade (N2SF N-05)', () => {
    expect(() => p.upsertProfile({ citizenId: 'x', interestTags: [] }, 'C')).toThrow('BLOCKED');
    expect(() => p.upsertProfile({ citizenId: 'x', interestTags: [] }, 'S')).toThrow('BLOCKED');
  });

  it('FR-R704.1/4: rejects invalid service id and unknown references', () => {
    expect(() => p.registerService({ serviceId: '', tags: [] })).toThrow('INVALID_SERVICE_ID');
    expect(() => p.recommend('nobody', 3)).toThrow('UNKNOWN_PROFILE');
    expect(() => p.recordFeedback('nobody', 'health', 'LIKE')).toThrow('UNKNOWN_PROFILE');
    expect(() => p.recordFeedback('900101-1234567', 'ghost', 'LIKE')).toThrow('UNKNOWN_SERVICE');
  });

  it('FR-R704.5: audit log uses masked citizenId', () => {
    p.recommend('900101-1234567', 3);
    const logs = p.getAuditLog();
    expect(logs.some((e) => e.action === 'UPSERT_PROFILE')).toBe(true);
    expect(logs.some((e) => e.action === 'RECOMMEND')).toBe(true);
    for (const e of logs) {
      expect(JSON.stringify(e.details ?? {})).not.toContain('900101');
    }
  });

  it('FR-R704.3: empty recommendation when no tag overlap', () => {
    p.upsertProfile({ citizenId: 'c2', interestTags: ['unrelated'] });
    const recs = p.recommend('c2', 3);
    expect(recs).toEqual([]);
  });
});
