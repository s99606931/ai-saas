import { describe, it, expect, beforeEach } from 'vitest';
import { SupplyChainMonitor, type Dependency } from '../supply-chain-monitor';

describe('SupplyChainMonitor', () => {
  let svc: SupplyChainMonitor;

  beforeEach(() => {
    svc = new SupplyChainMonitor();
  });

  it('FR-SC.1 그래프 구성', () => {
    const deps: Dependency[] = [
      { name: 'pkg-a', version: '1.0', source: 'npm', publisher: 'npmjs', updatedAt: '2026-01-01' },
    ];
    expect(() => svc.buildGraph(deps)).not.toThrow();
  });

  it('FR-SC.2 신뢰도 (높음)', () => {
    const t = svc.scoreTrust({ name: 'react', version: '18', source: 'npm', publisher: 'npmjs', updatedAt: '2025-01-01' });
    expect(t.score).toBeGreaterThan(0.7);
  });

  it('FR-SC.2 신뢰도 (의심)', () => {
    const t = svc.scoreTrust({ name: 'x', version: '0.1', source: 'npm', publisher: 'unknown', updatedAt: new Date().toISOString() });
    expect(t.factors).toContain('최근 업데이트 의심');
  });

  it('FR-SC.3 이상 업데이트 탐지', () => {
    const bad = svc.detectSuspiciousUpdate(
      { name: 'x', version: '2', source: 'npm', publisher: 'evil', updatedAt: '' },
      'npmjs',
    );
    expect(bad).toBe(true);
  });

  it('FR-SC.4 SBOM diff', () => {
    svc.trackSbom([{ name: 'a', version: '1', source: '', publisher: '', updatedAt: '' }]);
    const diff = svc.trackSbom([
      { name: 'a', version: '2', source: '', publisher: '', updatedAt: '' },
      { name: 'b', version: '1', source: '', publisher: '', updatedAt: '' },
    ]);
    expect(diff.added).toContain('b');
    expect(diff.upgraded[0]!.name).toBe('a');
  });

  it('FR-SC.5 격리 정책', () => {
    const q = svc.quarantine('bad-pkg', '신뢰도 낮음');
    expect(q.allowExec).toBe(false);
  });
});
