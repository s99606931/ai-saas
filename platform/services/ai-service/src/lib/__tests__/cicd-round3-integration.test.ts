import { describe, it, expect } from 'vitest';
import { CicdRound3Integration } from '../cicd-round3-integration';

describe('CicdRound3Integration', () => {
  const svc = new CicdRound3Integration();
  svc.registerCheck({ mtuId: 'MTU-N55', name: 'Velero', passed: true, details: 'OK' });
  svc.registerCheck({ mtuId: 'MTU-N56', name: 'KEDA', passed: true, details: 'OK' });
  svc.registerCheck({ mtuId: 'MTU-N57', name: 'Prometheus', passed: false, details: 'timeout' });

  it('register + run', () => {
    expect(svc.runAll().total).toBe(3);
    expect(svc.runAll().passed).toBe(2);
  });

  it('failed checks', () => {
    expect(svc.failedChecks().length).toBe(1);
  });

  it('release ready', () => {
    expect(svc.isReleaseReady(0.99)).toBe(false);
    expect(svc.isReleaseReady(0.5)).toBe(true);
  });

  it('markdown', () => {
    const md = svc.toMarkdown();
    expect(md).toContain('Coverage');
  });

  it('coverage metric', () => {
    expect(svc.runAll().coverage).toBeCloseTo(0.667, 2);
  });
});
