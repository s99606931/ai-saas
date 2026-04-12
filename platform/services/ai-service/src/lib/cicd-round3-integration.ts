// Design Ref: MTU-N60 §3라운드 CI/CD 고도화 통합 검증
// Plan SC: FR-N60.1~5

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
  coverage: number;
}

export class CicdRound3Integration {
  private checks: IntegrationCheck[] = [];

  registerCheck(check: IntegrationCheck): void {
    this.checks.push(check);
  }

  runAll(): IntegrationReport {
    const passed = this.checks.filter((c) => c.passed).length;
    return {
      total: this.checks.length,
      passed,
      failed: this.checks.length - passed,
      coverage: this.checks.length ? +(passed / this.checks.length).toFixed(3) : 0,
    };
  }

  failedChecks(): IntegrationCheck[] {
    return this.checks.filter((c) => !c.passed);
  }

  isReleaseReady(threshold = 0.95): boolean {
    return this.runAll().coverage >= threshold;
  }

  toMarkdown(): string {
    const r = this.runAll();
    const lines = [
      '# CI/CD Round 3 Integration Report',
      `- Total: ${r.total}`,
      `- Passed: ${r.passed}`,
      `- Failed: ${r.failed}`,
      `- Coverage: ${(r.coverage * 100).toFixed(1)}%`,
    ];
    return lines.join('\n');
  }
}
