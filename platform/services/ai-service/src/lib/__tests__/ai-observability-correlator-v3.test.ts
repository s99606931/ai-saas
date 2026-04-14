import { describe, it, expect, beforeEach } from 'vitest';
import { AIObservabilityCorrelatorV3 } from '../ai-observability-correlator-v3';

describe('AIObservabilityCorrelatorV3', () => {
  let cor: AIObservabilityCorrelatorV3;

  beforeEach(() => {
    cor = new AIObservabilityCorrelatorV3();
    cor.registerSignal({ signalId: 'api-errors', type: 'metric' });
    cor.registerSignal({ signalId: 'db-latency', type: 'metric' });
    cor.registerSignal({ signalId: 'cache-miss', type: 'metric' });
  });

  it('FR-R703.3: detects tight correlation within window', () => {
    cor.recordEvent('api-errors', 1000);
    cor.recordEvent('api-errors', 2000);
    cor.recordEvent('db-latency', 1010);
    cor.recordEvent('db-latency', 2020);
    const candidates = cor.findRootCauseCandidates('api-errors', 100, 0.5);
    expect(candidates.length).toBeGreaterThan(0);
    expect(candidates[0]!.score).toBeGreaterThanOrEqual(0.5);
    expect(candidates[0]!.maskedSignalId).toHaveLength(16);
  });

  it('FR-R703.4: filters out signals below threshold', () => {
    cor.recordEvent('api-errors', 1000);
    cor.recordEvent('cache-miss', 5000);
    const candidates = cor.findRootCauseCandidates('api-errors', 100, 0.9);
    expect(candidates.map((c) => c.score).every((s) => s >= 0.9)).toBe(true);
  });

  it('FR-R703.2: blocks C/S grade (N2SF N-05)', () => {
    expect(() => cor.recordEvent('api-errors', 1000, 'C')).toThrow('BLOCKED');
    expect(() => cor.recordEvent('api-errors', 1000, 'S')).toThrow('BLOCKED');
  });

  it('FR-R703.2: rejects unknown signal and invalid timestamp', () => {
    expect(() => cor.recordEvent('ghost', 1)).toThrow('UNKNOWN_SIGNAL');
    expect(() => cor.recordEvent('api-errors', -1)).toThrow('INVALID_TIMESTAMP');
  });

  it('FR-R703.4: rejects unknown target and invalid threshold', () => {
    expect(() => cor.findRootCauseCandidates('ghost', 100, 0.5)).toThrow('UNKNOWN_SIGNAL');
    expect(() => cor.findRootCauseCandidates('api-errors', 100, 2)).toThrow('INVALID_THRESHOLD');
  });

  it('FR-R703.5: audit log records register/record/correlate', () => {
    cor.recordEvent('api-errors', 1000);
    cor.findRootCauseCandidates('api-errors', 100, 0.1);
    const logs = cor.getAuditLog();
    expect(logs.some((e) => e.action === 'REGISTER_SIGNAL')).toBe(true);
    expect(logs.some((e) => e.action === 'RECORD_EVENT')).toBe(true);
    expect(logs.some((e) => e.action === 'CORRELATE')).toBe(true);
  });
});
