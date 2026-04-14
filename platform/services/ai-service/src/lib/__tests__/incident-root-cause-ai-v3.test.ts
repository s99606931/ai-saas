import { describe, it, expect } from 'vitest';
import { IncidentRootCauseAiV3 } from '../incident-root-cause-ai-v3.js';

describe('SVC-AI-ADV-R605 (v3) IncidentRootCauseAiV3', () => {
  const svc = new IncidentRootCauseAiV3();

  it('FR-R605v3.2: errorRate>0.5 → CODE_ERROR/CRITICAL/ROLLBACK', () => {
    const r = svc.analyze({
      incidentId: 'i1',
      errorRate: 0.6,
      latencyMs: 100,
      cpuPct: 50,
      memPct: 50,
      deployedRecently: false,
    });
    expect(r.rootCause).toBe('CODE_ERROR');
    expect(r.severity).toBe('CRITICAL');
    expect(r.recommendation).toBe('ROLLBACK');
  });

  it('FR-R605v3.2: latencyMs>5000 → RESOURCE_EXHAUSTION', () => {
    const r = svc.analyze({
      incidentId: 'i2',
      errorRate: 0.1,
      latencyMs: 6000,
      cpuPct: 50,
      memPct: 50,
      deployedRecently: false,
    });
    expect(r.rootCause).toBe('RESOURCE_EXHAUSTION');
    expect(r.recommendation).toBe('SCALE_OUT');
  });

  it('FR-R605v3.2: memPct>90 → MEMORY_LEAK', () => {
    const r = svc.analyze({
      incidentId: 'i3',
      errorRate: 0.1,
      latencyMs: 100,
      cpuPct: 50,
      memPct: 95,
      deployedRecently: false,
    });
    expect(r.rootCause).toBe('MEMORY_LEAK');
    expect(r.recommendation).toBe('SCALE_OUT');
  });

  it('FR-R605v3.2: deployedRecently → RECENT_DEPLOY/HIGH/ROLLBACK', () => {
    const r = svc.analyze({
      incidentId: 'i4',
      errorRate: 0.1,
      latencyMs: 100,
      cpuPct: 50,
      memPct: 50,
      deployedRecently: true,
    });
    expect(r.rootCause).toBe('RECENT_DEPLOY');
    expect(r.severity).toBe('HIGH');
  });

  it('FR-R605v3.2: 정상 → UNKNOWN/LOW/MONITOR', () => {
    const r = svc.analyze({
      incidentId: 'i5',
      errorRate: 0.01,
      latencyMs: 100,
      cpuPct: 30,
      memPct: 30,
      deployedRecently: false,
    });
    expect(r.rootCause).toBe('UNKNOWN');
    expect(r.severity).toBe('LOW');
    expect(r.recommendation).toBe('MONITOR');
  });

  it('FR-R605v3.5: 감사 로그', () => {
    const local = new IncidentRootCauseAiV3();
    local.analyze({
      incidentId: 'i6',
      errorRate: 0.01,
      latencyMs: 100,
      cpuPct: 30,
      memPct: 30,
      deployedRecently: false,
    });
    expect(local.getAuditLog()).toHaveLength(1);
  });
});
