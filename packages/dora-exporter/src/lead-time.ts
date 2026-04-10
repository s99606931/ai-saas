/**
 * 변경 리드타임 계산기
 * Design Ref: docs/02-design/mtus/MTU-N169-dora-metrics.design.md §3.2
 * Plan SC: FR-DORA.2
 */

interface LeadTimeRecord {
  team: string;
  service: string;
  commitTimestamp: number;
  deployTimestamp: number;
  leadTimeSeconds: number;
}

export class LeadTimeCalculator {
  private records: LeadTimeRecord[] = [];
  private readonly maxRecords = 10000;

  /**
   * 리드타임 계산 (초 단위)
   * 첫 커밋 타임스탬프에서 프로덕션 배포 타임스탬프까지의 시간
   */
  calculate(commitTimestamp: number, deployTimestamp: number): number {
    const leadTime = (deployTimestamp - commitTimestamp) / 1000;
    return Math.max(0, leadTime);
  }

  /**
   * 리드타임 기록 저장
   */
  record(team: string, service: string, commitTimestamp: number, deployTimestamp: number): void {
    const leadTimeSeconds = this.calculate(commitTimestamp, deployTimestamp);

    this.records.push({
      team,
      service,
      commitTimestamp,
      deployTimestamp,
      leadTimeSeconds,
    });

    // 메모리 관리: 최대 레코드 수 초과 시 오래된 것 제거
    if (this.records.length > this.maxRecords) {
      this.records = this.records.slice(-this.maxRecords);
    }
  }

  /**
   * 팀별 중앙값 리드타임 (초)
   */
  getMedian(team: string): number {
    const teamRecords = this.records
      .filter(r => r.team === team)
      .map(r => r.leadTimeSeconds)
      .sort((a, b) => a - b);

    if (teamRecords.length === 0) return 0;

    const mid = Math.floor(teamRecords.length / 2);
    if (teamRecords.length % 2 === 0) {
      return (teamRecords[mid - 1] + teamRecords[mid]) / 2;
    }
    return teamRecords[mid];
  }

  /**
   * 팀별 평균 리드타임 (초)
   */
  getAverage(team: string): number {
    const teamRecords = this.records.filter(r => r.team === team);
    if (teamRecords.length === 0) return 0;

    const sum = teamRecords.reduce((acc, r) => acc + r.leadTimeSeconds, 0);
    return sum / teamRecords.length;
  }

  /**
   * 팀별 P95 리드타임 (초)
   */
  getP95(team: string): number {
    const sorted = this.records
      .filter(r => r.team === team)
      .map(r => r.leadTimeSeconds)
      .sort((a, b) => a - b);

    if (sorted.length === 0) return 0;

    const index = Math.ceil(sorted.length * 0.95) - 1;
    return sorted[Math.min(index, sorted.length - 1)];
  }

  /**
   * 전체 레코드 수
   */
  getRecordCount(): number {
    return this.records.length;
  }
}
