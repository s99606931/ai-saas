// Design Ref: MTU-N489 §의존성 취약 PR 생성
// Plan SC: FR-DEP.1~5

export type Severity = 'low' | 'medium' | 'high' | 'critical';

export interface Vulnerability {
  packageName: string;
  currentVersion: string;
  patchedVersion: string;
  severity: Severity;
  cve: string;
}

export interface UpdatePath {
  packageName: string;
  from: string;
  to: string;
  breaking: boolean;
}

export interface AutoPr {
  branch: string;
  title: string;
  body: string;
  updates: UpdatePath[];
}

export interface MergeCheck {
  prBranch: string;
  testsPassed: boolean;
  breakingDetected: boolean;
  safe: boolean;
}

export class DepAutoPr {
  /** FR-DEP.1 취약 의존성 스캔 (입력값 정리) */
  scanVulnerabilities(vulns: Vulnerability[]): Vulnerability[] {
    const order = { critical: 0, high: 1, medium: 2, low: 3 };
    return [...vulns].sort((a, b) => order[a.severity] - order[b.severity]);
  }

  /** FR-DEP.2 업데이트 경로 계산 */
  computeUpdatePath(vuln: Vulnerability): UpdatePath {
    const curMajor = Number(vuln.currentVersion.split('.')[0]);
    const tgtMajor = Number(vuln.patchedVersion.split('.')[0]);
    return {
      packageName: vuln.packageName,
      from: vuln.currentVersion,
      to: vuln.patchedVersion,
      breaking: tgtMajor > curMajor,
    };
  }

  /** FR-DEP.3 브랜치 + PR 생성 */
  generatePr(vulns: Vulnerability[]): AutoPr {
    const updates = vulns.map((v) => this.computeUpdatePath(v));
    const timestamp = new Date().toISOString().slice(0, 10);
    const branch = `fix/deps-${timestamp}`;
    const title = `fix(deps): ${vulns.length}개 취약점 패치 (${vulns[0]?.severity ?? 'low'})`;
    const body = [
      '## 취약점 수정',
      '',
      ...vulns.map((v) => `- ${v.packageName} ${v.currentVersion} → ${v.patchedVersion} (${v.cve}, ${v.severity})`),
    ].join('\n');
    return { branch, title, body, updates };
  }

  /** FR-DEP.4 파괴적 변경 감지 */
  detectBreaking(updates: UpdatePath[]): UpdatePath[] {
    return updates.filter((u) => u.breaking);
  }

  /** FR-DEP.5 병합 검증 */
  verifyMerge(prBranch: string, testsPassed: boolean, updates: UpdatePath[]): MergeCheck {
    const breakingDetected = this.detectBreaking(updates).length > 0;
    return {
      prBranch,
      testsPassed,
      breakingDetected,
      safe: testsPassed && !breakingDetected,
    };
  }
}

export const depAutoPr = new DepAutoPr();
