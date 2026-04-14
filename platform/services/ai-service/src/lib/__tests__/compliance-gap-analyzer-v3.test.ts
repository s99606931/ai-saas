import { describe, it, expect } from 'vitest';
import { ComplianceGapAnalyzerV3 } from '../compliance-gap-analyzer-v3.js';

describe('SVC-AI-ADV-R604 (v3) ComplianceGapAnalyzerV3', () => {
  const svc = new ComplianceGapAnalyzerV3();

  it('FR-R604v3.2: 갭 식별 (required && !implemented)', () => {
    const r = svc.analyze([
      { id: 'c1', required: true, implemented: false, severity: 'HIGH' },
      { id: 'c2', required: true, implemented: true, severity: 'HIGH' },
      { id: 'c3', required: false, implemented: false, severity: 'HIGH' },
    ]);
    expect(r.gaps).toBe(1);
  });

  it('FR-R604v3.3: gapScore 가중 합', () => {
    const r = svc.analyze([
      { id: 'c1', required: true, implemented: false, severity: 'CRITICAL' },
      { id: 'c2', required: true, implemented: false, severity: 'LOW' },
    ]);
    expect(r.gapScore).toBe(11);
  });

  it('FR-R604v3.4: severity 내림차순 우선순위', () => {
    const r = svc.analyze([
      { id: 'a', required: true, implemented: false, severity: 'LOW' },
      { id: 'b', required: true, implemented: false, severity: 'CRITICAL' },
      { id: 'c', required: true, implemented: false, severity: 'MEDIUM' },
    ]);
    expect(r.prioritized).toEqual(['b', 'c', 'a']);
  });

  it('FR-R604v3.5: totalControls 카운트', () => {
    const r = svc.analyze([
      { id: 'a', required: true, implemented: true, severity: 'LOW' },
      { id: 'b', required: false, implemented: false, severity: 'HIGH' },
    ]);
    expect(r.totalControls).toBe(2);
    expect(r.gaps).toBe(0);
  });

  it('감사 로그', () => {
    const local = new ComplianceGapAnalyzerV3();
    local.analyze([{ id: 'x', required: true, implemented: false, severity: 'HIGH' }]);
    const log = local.getAuditLog();
    expect(log).toHaveLength(1);
    expect(log[0]?.action).toBe('GAP_ANALYZE');
  });
});
