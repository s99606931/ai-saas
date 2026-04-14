import { describe, it, expect, beforeEach } from 'vitest';
import { NetworkTrafficClassifierAIV3 } from '../network-traffic-classifier-ai-v3';

describe('NetworkTrafficClassifierAIV3', () => {
  let c: NetworkTrafficClassifierAIV3;

  beforeEach(() => {
    c = new NetworkTrafficClassifierAIV3();
  });

  it('classifies SSH as MANAGEMENT', () => {
    const r = c.classify({ srcIp: '10.0.0.1', dstIp: '10.0.0.2', port: 22, bytesPerSec: 1000 });
    expect(r.category).toBe('MANAGEMENT');
  });

  it('classifies HTTPS as BUSINESS', () => {
    const r = c.classify({ srcIp: '10.0.0.1', dstIp: '10.0.0.2', port: 443, bytesPerSec: 50000 });
    expect(r.category).toBe('BUSINESS');
  });

  it('classifies massive bytesPerSec as ANOMALY', () => {
    const r = c.classify({ srcIp: '10.0.0.1', dstIp: '10.0.0.2', port: 443, bytesPerSec: 5e8 });
    expect(r.category).toBe('ANOMALY');
  });

  it('masks src/dst IPs', () => {
    const r = c.classify({ srcIp: '10.0.0.1', dstIp: '10.0.0.2', port: 80, bytesPerSec: 1000 });
    expect(r.maskedSrc).toMatch(/^[0-9a-f]{16}$/);
    expect(r.maskedDst).toMatch(/^[0-9a-f]{16}$/);
    expect(r.maskedSrc).not.toEqual(r.maskedDst);
  });

  it('blocks C/S grade (N2SF N-05)', () => {
    const flow = { srcIp: '1.1.1.1', dstIp: '2.2.2.2', port: 80, bytesPerSec: 100 };
    expect(() => c.classify(flow, 'C')).toThrow('BLOCKED');
    expect(() => c.classify(flow, 'S')).toThrow('BLOCKED');
  });

  it('records audit log', () => {
    c.classify({ srcIp: '10.0.0.1', dstIp: '10.0.0.2', port: 22, bytesPerSec: 1000 });
    expect(c.getAuditLog().some((e) => e.action === 'CLASSIFY_FLOW')).toBe(true);
  });
});
