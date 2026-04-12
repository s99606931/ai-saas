// Design Ref: MTU-N52 §2라운드 CI/CD 고도화 통합 검증
// Plan SC: FR-N52.1~5

export interface IntegrationCheck {
  mtuId: string;
  name: string;
  passed: boolean;
  details: string;
}

export interface IntegrationReport {
  total: number;
  passed: number;
  failed: number;
  checks: IntegrationCheck[];
  coverage: number;
}

export class CicdRound2Integration {
  private checks: IntegrationCheck[] = [];

  /** FR-N52.1 MTU 검증 등록 */
  registerCheck(check: IntegrationCheck): void {
    this.checks.push(check);
  }

  /** FR-N52.2 통합 실행 */
  runAll(): IntegrationReport {
    const passed = this.checks.filter((c) => c.passed).length;
    const failed = this.checks.length - passed;
    return {
      total: this.checks.length,
      passed,
      failed,
      checks: [...this.checks],
      coverage: this.checks.length === 0 ? 0 : +(passed / this.checks.length).toFixed(3),
    };
  }

  /** FR-N52.3 실패 항목 필터링 */
  failedChecks(): IntegrationCheck[] {
    return this.checks.filter((c) => !c.passed);
  }

  /** FR-N52.4 릴리스 준비 판단 */
  isReleaseReady(threshold = 0.95): boolean {
    const r = this.runAll();
    return r.coverage >= threshold;
  }

  /** FR-N52.5 감사 리포트 생성 */
  toMarkdown(): string {
    const r = this.runAll();
    const lines = [
      '# CI/CD Round 2 Integration Report',
      '',
      `- Total: ${r.total}`,
      `- Passed: ${r.passed}`,
      `- Failed: ${r.failed}`,
      `- Coverage: ${(r.coverage * 100).toFixed(1)}%`,
      '',
      '## Checks',
    ];
    r.checks.forEach((c) => {
      lines.push(`- ${c.passed ? '✅' : '❌'} ${c.mtuId}: ${c.name} — ${c.details}`);
    });
    return lines.join('\n');
  }
}

export const cicdRound2Integration = new CicdRound2Integration();
