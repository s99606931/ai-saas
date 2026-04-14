import { describe, it, expect, beforeEach } from 'vitest';
import { IntelligentCacheManagerV3 } from '../intelligent-cache-manager-v3';

describe('IntelligentCacheManagerV3', () => {
  let mgr: IntelligentCacheManagerV3;
  const now = new Date('2026-04-14T12:00:00Z');

  beforeEach(() => {
    mgr = new IntelligentCacheManagerV3();
  });

  it('classifies HOT for many recent hits', () => {
    mgr.record('user:1', 500, now);
    const r = mgr.recommend(now);
    expect(r[0]!.tier).toBe('HOT');
    expect(r[0]!.ttlSec).toBe(3600);
  });

  it('classifies COLD for stale low-hit key', () => {
    const old = new Date('2026-04-13T00:00:00Z');
    mgr.record('user:1', 5, old);
    const r = mgr.recommend(now);
    expect(r[0]!.tier).toBe('COLD');
  });

  it('classifies WARM in mid range', () => {
    mgr.record('user:1', 30, now);
    const r = mgr.recommend(now);
    expect(r[0]!.tier).toBe('WARM');
    expect(r[0]!.ttlSec).toBe(600);
  });

  it('aggregates repeated records', () => {
    mgr.record('user:1', 50, now);
    mgr.record('user:1', 100, now);
    const r = mgr.recommend(now);
    expect(r).toHaveLength(1);
    expect(r[0]!.tier).toBe('HOT');
  });

  it('masks keys', () => {
    mgr.record('email:user@gov.kr', 1, now);
    const r = mgr.recommend(now);
    expect(r[0]!.maskedKey).toMatch(/^[0-9a-f]{16}$/);
    expect(r[0]!.maskedKey).not.toContain('@');
  });

  it('blocks C/S grade (N2SF N-05)', () => {
    mgr.record('k', 1, now);
    expect(() => mgr.recommend(now, 'C')).toThrow('BLOCKED');
    expect(() => mgr.recommend(now, 'S')).toThrow('BLOCKED');
  });

  it('records audit log', () => {
    mgr.record('k', 1, now);
    mgr.recommend(now);
    const log = mgr.getAuditLog();
    expect(log.some((e) => e.action === 'RECORD_ACCESS')).toBe(true);
    expect(log.some((e) => e.action === 'RECOMMEND')).toBe(true);
  });
});
