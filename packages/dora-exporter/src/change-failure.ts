/**
 * 변경 실패율 감지기
 * Design Ref: docs/02-design/mtus/MTU-N169-dora-metrics.design.md §3.3
 * Plan SC: FR-DORA.3
 */

interface DeploymentRecord {
  timestamp: number;
  isFailure: boolean;
}

interface TeamServiceKey {
  team: string;
  service: string;
}

export class ChangeFailureDetector {
  /** 팀-서비스별 배포 기록 */
  private deployments = new Map<string, DeploymentRecord[]>();
  /** 실패 판정 패턴 (롤백, 핫픽스, 긴급 수정) */
  private readonly failurePatterns = [
    /^(revert|rollback):/i,
    /^(hotfix|fix!):/i,
    /^(fix|bugfix)!:/i,
    /rollback/i,
    /emergency\s+fix/i,
    /critical\s+fix/i,
  ];

  private readonly maxRecordsPerKey = 1000;
  private readonly windowDays = 30;

  /**
   * 커밋 메시지 기반 실패 배포 감지
   */
  detect(commits: Array<{ message: string }>): boolean {
    return commits.some(commit =>
      this.failurePatterns.some(pattern => pattern.test(commit.message))
    );
  }

  /**
   * 성공 배포 기록
   */
  recordSuccess(team: string, service: string): void {
    this.addRecord(team, service, false);
  }

  /**
   * 실패 배포 기록
   */
  recordFailure(team: string, service: string): void {
    this.addRecord(team, service, true);
  }

  /**
   * 팀-서비스별 변경 실패율 (최근 30일)
   */
  getRate(team: string, service: string): number {
    const key = this.makeKey(team, service);
    const records = this.getRecentRecords(key);

    if (records.length === 0) return 0;

    const failures = records.filter(r => r.isFailure).length;
    return failures / records.length;
  }

  /**
   * 팀 전체의 변경 실패율
   */
  getTeamRate(team: string): number {
    let totalDeployments = 0;
    let totalFailures = 0;

    for (const [key, records] of this.deployments.entries()) {
      if (key.startsWith(`${team}:`)) {
        const recent = this.filterRecent(records);
        totalDeployments += recent.length;
        totalFailures += recent.filter(r => r.isFailure).length;
      }
    }

    if (totalDeployments === 0) return 0;
    return totalFailures / totalDeployments;
  }

  /**
   * 등록된 모든 팀 목록
   */
  getTeams(): string[] {
    const teams = new Set<string>();
    for (const key of this.deployments.keys()) {
      const team = key.split(':')[0];
      teams.add(team);
    }
    return Array.from(teams);
  }

  private addRecord(team: string, service: string, isFailure: boolean): void {
    const key = this.makeKey(team, service);
    if (!this.deployments.has(key)) {
      this.deployments.set(key, []);
    }

    const records = this.deployments.get(key)!;
    records.push({ timestamp: Date.now(), isFailure });

    // 메모리 관리
    if (records.length > this.maxRecordsPerKey) {
      this.deployments.set(key, records.slice(-this.maxRecordsPerKey));
    }
  }

  private getRecentRecords(key: string): DeploymentRecord[] {
    const records = this.deployments.get(key) || [];
    return this.filterRecent(records);
  }

  private filterRecent(records: DeploymentRecord[]): DeploymentRecord[] {
    const cutoff = Date.now() - this.windowDays * 24 * 60 * 60 * 1000;
    return records.filter(r => r.timestamp >= cutoff);
  }

  private makeKey(team: string, service: string): string {
    return `${team}:${service}`;
  }
}
