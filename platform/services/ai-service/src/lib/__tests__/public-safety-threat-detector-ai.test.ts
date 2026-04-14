import { describe, it, expect, beforeEach } from 'vitest';
import { PublicSafetyThreatDetector, type ThreatEvent } from '../public-safety-threat-detector-ai';

describe('PublicSafetyThreatDetector', () => {
  let detector: PublicSafetyThreatDetector;

  beforeEach(() => {
    detector = new PublicSafetyThreatDetector();
  });

  it('classifies severity>=0.8 as CRITICAL', () => {
    const events: ThreatEvent[] = [
      { eventId: 'E1', type: 'intrusion', severity: 0.9, location: 'Seoul Station', timestamp: '2026-04-13T10:00:00Z', grade: 'O' },
    ];
    const results = detector.detect(events);
    expect(results[0]!.level).toBe('CRITICAL');
  });

  it('classifies severity>=0.6 and <0.8 as HIGH', () => {
    const events: ThreatEvent[] = [
      { eventId: 'E2', type: 'suspicious', severity: 0.7, location: 'City Hall', timestamp: '2026-04-13T10:00:00Z', grade: 'O' },
    ];
    const results = detector.detect(events);
    expect(results[0]!.level).toBe('HIGH');
  });

  it('classifies severity>=0.4 and <0.6 as MEDIUM', () => {
    const events: ThreatEvent[] = [
      { eventId: 'E3', type: 'anomaly', severity: 0.5, location: 'Park Road', timestamp: '2026-04-13T10:00:00Z', grade: 'O' },
    ];
    const results = detector.detect(events);
    expect(results[0]!.level).toBe('MEDIUM');
  });

  it('classifies severity<0.4 as LOW', () => {
    const events: ThreatEvent[] = [
      { eventId: 'E4', type: 'noise', severity: 0.2, location: 'Market St', timestamp: '2026-04-13T10:00:00Z', grade: 'O' },
    ];
    const results = detector.detect(events);
    expect(results[0]!.level).toBe('LOW');
  });

  it('throws BLOCKED for C grade event', () => {
    const events: ThreatEvent[] = [
      { eventId: 'E5', type: 'secret', severity: 0.9, location: 'HQ', timestamp: '2026-04-13T10:00:00Z', grade: 'C' },
    ];
    expect(() => detector.detect(events)).toThrow('BLOCKED');
  });

  it('masks location to first 3 chars + ***', () => {
    const events: ThreatEvent[] = [
      { eventId: 'E6', type: 'fire', severity: 0.5, location: 'Gangnam-gu Station', timestamp: '2026-04-13T10:00:00Z', grade: 'O' },
    ];
    const results = detector.detect(events);
    expect(results[0]!.maskedLocation).toBe('Gan***');
  });

  it('records audit log on detect', () => {
    detector.detect([
      { eventId: 'E7', type: 'test', severity: 0.3, location: 'TestLoc', timestamp: '2026-04-13T10:00:00Z', grade: 'O' },
    ]);
    const log = detector.getAuditLog();
    expect(log[0]!.action).toBe('threat.detect');
  });
});
