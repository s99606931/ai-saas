import { describe, it, expect, beforeEach } from 'vitest';
import { IncidentCorrelationAIV3 } from '../incident-correlation-ai-v3';

describe('IncidentCorrelationAIV3', () => {
  let corr: IncidentCorrelationAIV3;
  const baseTime = 1_700_000_000_000;

  beforeEach(() => {
    corr = new IncidentCorrelationAIV3();
    corr.registerIncident({
      incidentId: 'inc1',
      service: 'api',
      severity: 4,
      openedAt: baseTime,
    });
  });

  it('judges ROOT_CAUSE for same service within 5 minutes same severity', () => {
    const v = corr.addEvent({
      incidentId: 'inc1',
      responderId: '900101-1',
      eventService: 'api',
      eventSeverity: 4,
      eventAt: baseTime + 60_000,
    });
    expect(v.verdict).toBe('ROOT_CAUSE');
    expect(v.maskedResponderId).toHaveLength(16);
    expect(v.maskedResponderId).not.toContain('900101');
  });

  it('judges RELATED for same service far in time', () => {
    const v = corr.addEvent({
      incidentId: 'inc1',
      responderId: 'r',
      eventService: 'api',
      eventSeverity: 4,
      eventAt: baseTime + 10 * 60_000,
    });
    expect(v.verdict).toBe('RELATED');
  });

  it('judges UNRELATED for different service far in time', () => {
    const v = corr.addEvent({
      incidentId: 'inc1',
      responderId: 'r',
      eventService: 'web',
      eventSeverity: 4,
      eventAt: baseTime + 30 * 60_000,
    });
    expect(v.verdict).toBe('UNRELATED');
  });

  it('blocks C/S grade (N2SF N-05)', () => {
    const ev = {
      incidentId: 'inc1',
      responderId: 'r',
      eventService: 'api',
      eventSeverity: 4,
      eventAt: baseTime,
    };
    expect(() => corr.addEvent(ev, 'C')).toThrow('BLOCKED');
    expect(() => corr.addEvent(ev, 'S')).toThrow('BLOCKED');
  });

  it('rejects unknown incident and invalid severity', () => {
    expect(() =>
      corr.addEvent({
        incidentId: 'missing',
        responderId: 'r',
        eventService: 'api',
        eventSeverity: 3,
        eventAt: baseTime,
      }),
    ).toThrow('UNKNOWN_INCIDENT');
    expect(() =>
      corr.registerIncident({
        incidentId: 'x',
        service: 'api',
        severity: 9,
        openedAt: baseTime,
      }),
    ).toThrow('INVALID_SEVERITY');
  });

  it('audit log masks responder id', () => {
    corr.addEvent({
      incidentId: 'inc1',
      responderId: '900101-1234567',
      eventService: 'api',
      eventSeverity: 4,
      eventAt: baseTime,
    });
    const log = corr.getAuditLog();
    expect(log.some((e) => e.action === 'ADD_EVENT')).toBe(true);
    for (const entry of log) {
      expect(JSON.stringify(entry.details ?? {})).not.toContain('900101');
    }
  });
});
