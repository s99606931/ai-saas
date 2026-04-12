import { describe, it, expect } from 'vitest';
import { DepAutoPr, type Vulnerability } from '../dep-auto-pr';

describe('DepAutoPr', () => {
  const svc = new DepAutoPr();

  const vulns: Vulnerability[] = [
    { packageName: 'lib-a', currentVersion: '1.0.0', patchedVersion: '1.0.1', severity: 'medium', cve: 'CVE-1' },
    { packageName: 'lib-b', currentVersion: '2.0.0', patchedVersion: '3.0.0', severity: 'critical', cve: 'CVE-2' },
  ];

  it('FR-DEP.1 스캔 정렬', () => {
    const sorted = svc.scanVulnerabilities(vulns);
    expect(sorted[0]!.severity).toBe('critical');
  });

  it('FR-DEP.2 업데이트 경로', () => {
    const p = svc.computeUpdatePath(vulns[1]!);
    expect(p.breaking).toBe(true);
  });

  it('FR-DEP.3 PR 생성', () => {
    const pr = svc.generatePr(vulns);
    expect(pr.branch).toContain('fix/deps');
    expect(pr.body).toContain('CVE-1');
  });

  it('FR-DEP.4 파괴적 변경', () => {
    const updates = vulns.map((v) => svc.computeUpdatePath(v));
    expect(svc.detectBreaking(updates).length).toBe(1);
  });

  it('FR-DEP.5 병합 검증', () => {
    const updates = [svc.computeUpdatePath(vulns[0]!)];
    const check = svc.verifyMerge('fix/deps-x', true, updates);
    expect(check.safe).toBe(true);
  });
});
