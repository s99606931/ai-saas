import { describe, it, expect } from 'vitest';
import { AppLogAnomaly } from '../app-log-anomaly';

describe('AppLogAnomaly', () => {
  const cfg = { enabled: true, namespace: 'ns', version: '1.0.0' };
  const rule = { id: 'r1', name: 'n', severity: 'high' as const, action: 'alert' as const };
  it('config', () => { const s = new AppLogAnomaly(); expect(s.validateConfig(cfg)).toBe(true); expect(s.validateConfig({ ...cfg, namespace: '' })).toBe(false); });
  it('rule', () => { const s = new AppLogAnomaly(); s.registerRule(rule); expect(() => s.registerRule(rule)).toThrow(); });
  it('eval', () => { const s = new AppLogAnomaly(); s.registerRule(rule); expect(s.evaluate('a','b','r1').severity).toBe('high'); });
  it('status', () => { const s = new AppLogAnomaly(); s.registerRule(rule); s.evaluate('a','b','r1'); expect(s.getStatus().eventsProcessed).toBe(1); });
  it('audit', () => { const s = new AppLogAnomaly(); s.registerRule(rule); s.evaluate('a','b','r1'); expect(s.getAuditLog().length).toBe(1); });
});
