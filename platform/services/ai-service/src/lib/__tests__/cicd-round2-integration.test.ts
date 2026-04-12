import { describe, it, expect } from 'vitest';
import { CicdRound2Integration } from '../cicd-round2-integration';

describe('CicdRound2Integration', () => {
  const svc = new CicdRound2Integration();
  svc.registerCheck({ mtuId: 'MTU-N45', name: 'Falco', passed: true, details: 'OK' });
  svc.registerCheck({ mtuId: 'MTU-N46', name: 'SLSA', passed: true, details: 'OK' });
  svc.registerCheck({ mtuId: 'MTU-N47', name: 'Flux', passed: false, details: 'drift detected' });

  it('FR-N52.1 체크 등록', () => {
    const r = svc.runAll();
    expect(r.total).toBe(3);
  });

  it('FR-N52.2 통합 실행', () => {
    const r = svc.runAll();
    expect(r.passed).toBe(2);
    expect(r.failed).toBe(1);
  });

  it('FR-N52.3 실패 항목', () => {
    expect(svc.failedChecks().length).toBe(1);
  });

  it('FR-N52.4 릴리스 준비 판단', () => {
    expect(svc.isReleaseReady(0.99)).toBe(false);
    expect(svc.isReleaseReady(0.5)).toBe(true);
  });

  it('FR-N52.5 마크다운 리포트', () => {
    const md = svc.toMarkdown();
    expect(md).toContain('Coverage');
    expect(md).toContain('MTU-N45');
  });
});
