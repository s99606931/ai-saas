import { describe, it, expect, beforeEach } from 'vitest';
import { RealtimeThreatClassifierV2, type SecurityEvent } from '../realtime-threat-classifier-v2';

describe('RealtimeThreatClassifierV2', () => {
  let classifier: RealtimeThreatClassifierV2;

  beforeEach(() => {
    classifier = new RealtimeThreatClassifierV2();
  });

  it('classifies SQL keyword as SQL_INJECTION with CRITICAL severity', () => {
    const events: SecurityEvent[] = [
      { eventId: 'E1', source: 'web', eventType: 'request', payload: "SELECT * FROM users WHERE id='1'", grade: 'O' },
    ];
    const result = classifier.classify(events);
    expect(result[0]!.threatType).toBe('SQL_INJECTION');
    expect(result[0]!.severity).toBe('CRITICAL');
    expect(result[0]!.response).toBe('BLOCK_AND_ALERT');
  });

  it('classifies XSS pattern as XSS with HIGH severity', () => {
    const events: SecurityEvent[] = [
      { eventId: 'E2', source: 'web', eventType: 'request', payload: '<script>alert(1)</script>', grade: 'O' },
    ];
    const result = classifier.classify(events);
    expect(result[0]!.threatType).toBe('XSS');
    expect(result[0]!.severity).toBe('HIGH');
    expect(result[0]!.response).toBe('BLOCK');
  });

  it('classifies brute force keywords as BRUTE_FORCE', () => {
    const events: SecurityEvent[] = [
      { eventId: 'E3', source: 'auth', eventType: 'login', payload: 'multiple login password attempt', grade: 'O' },
    ];
    const result = classifier.classify(events);
    expect(result[0]!.threatType).toBe('BRUTE_FORCE');
  });

  it('classifies ddos keyword as DDOS with CRITICAL', () => {
    const events: SecurityEvent[] = [
      { eventId: 'E4', source: 'network', eventType: 'traffic', payload: 'flood ddos attack detected', grade: 'O' },
    ];
    const result = classifier.classify(events);
    expect(result[0]!.threatType).toBe('DDOS');
    expect(result[0]!.severity).toBe('CRITICAL');
  });

  it('classifies unknown payload as UNKNOWN MEDIUM', () => {
    const events: SecurityEvent[] = [
      { eventId: 'E5', source: 'app', eventType: 'error', payload: 'normal error message', grade: 'O' },
    ];
    const result = classifier.classify(events);
    expect(result[0]!.threatType).toBe('UNKNOWN');
    expect(result[0]!.severity).toBe('MEDIUM');
    expect(result[0]!.response).toBe('LOG_AND_MONITOR');
  });

  it('throws BLOCKED for S grade event', () => {
    const events: SecurityEvent[] = [
      { eventId: 'E6', source: 'classified', eventType: 'alert', payload: 'secret payload', grade: 'S' },
    ];
    expect(() => classifier.classify(events)).toThrow('BLOCKED');
  });

  it('records audit log', () => {
    classifier.classify([
      { eventId: 'E7', source: 'test', eventType: 'test', payload: 'test data', grade: 'O' },
    ]);
    const log = classifier.getAuditLog();
    expect(log[0]!.action).toBe('threat.classify');
  });
});
