import { describe, it, expect, beforeEach } from 'vitest';
import { AiThreatIntelAggregatorV2 } from '../ai-threat-intel-aggregator-v2';

describe('AiThreatIntelAggregatorV2', () => {
  let svc: AiThreatIntelAggregatorV2;

  beforeEach(() => {
    svc = new AiThreatIntelAggregatorV2();
    svc.registerFeed({ feedId: 'feed1', name: 'OSINT', reliability: 0.9 });
  });

  it('FR-R682.3/4: CRITICAL grade for score>=0.8', () => {
    const r = svc.ingest({
      iocId: 'ioc1',
      feedId: 'feed1',
      severity: 0.95,
      analystEmail: 'analyst@example.com',
    });
    expect(r.grade).toBe('CRITICAL');
    expect(r.maskedAnalyst).toHaveLength(16);
    expect(r.maskedAnalyst).not.toContain('analyst');
  });

  it('HIGH grade for 0.5~0.8', () => {
    const r = svc.ingest({ iocId: 'ioc2', feedId: 'feed1', severity: 0.7, analystEmail: 'a@b' });
    expect(r.grade).toBe('HIGH');
  });

  it('merges duplicate iocId with max score', () => {
    svc.ingest({ iocId: 'ioc3', feedId: 'feed1', severity: 0.3, analystEmail: 'a@b' });
    svc.registerFeed({ feedId: 'feed2', name: 'Premium', reliability: 1.0 });
    const r = svc.ingest({ iocId: 'ioc3', feedId: 'feed2', severity: 0.9, analystEmail: 'a@b' });
    expect(r.score).toBeGreaterThanOrEqual(0.9);
    expect(r.grade).toBe('CRITICAL');
  });

  it('FR-R682.2: C/S grade blocked', () => {
    expect(() =>
      svc.ingest({ iocId: 'x', feedId: 'feed1', severity: 0.5, analystEmail: 'a' }, 'C'),
    ).toThrow('BLOCKED');
    expect(() =>
      svc.ingest({ iocId: 'x', feedId: 'feed1', severity: 0.5, analystEmail: 'a' }, 'S'),
    ).toThrow('BLOCKED');
  });

  it('rejects unknown feed / invalid severity / invalid reliability', () => {
    expect(() =>
      svc.ingest({ iocId: 'x', feedId: 'ghost', severity: 0.5, analystEmail: 'a' }),
    ).toThrow('UNKNOWN_FEED');
    expect(() =>
      svc.ingest({ iocId: 'x', feedId: 'feed1', severity: 2, analystEmail: 'a' }),
    ).toThrow('INVALID_SEVERITY');
    expect(() => svc.registerFeed({ feedId: 'bad', name: 'x', reliability: 2 })).toThrow(
      'INVALID_RELIABILITY',
    );
  });

  it('FR-R682.5: audit log masks analyst email', () => {
    svc.ingest({
      iocId: 'ioc9',
      feedId: 'feed1',
      severity: 0.6,
      analystEmail: 'leak@example.com',
    });
    const audit = svc.getAuditLog();
    expect(audit.some((e) => e.action === 'INGEST')).toBe(true);
    for (const entry of audit) {
      expect(JSON.stringify(entry.details ?? {})).not.toContain('leak@example.com');
    }
  });
});
