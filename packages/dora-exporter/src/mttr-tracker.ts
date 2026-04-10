/**
 * MTTR(Mean Time To Recovery) 추적기
 * Design Ref: docs/02-design/mtus/MTU-N169-dora-metrics.design.md §3.4
 * Plan SC: FR-DORA.4
 */

interface IncidentRecord {
  service: string;
  team: string;
  startedAt: number;
  resolvedAt: number | null;
  mttrSeconds: number | null;
}

export class MTTRTracker {
  /** 활성 장애 목록 (미해결) */
  private activeIncidents = new Map<string, IncidentRecord>();
  /** 해결된 장애 기록 */
  private resolvedIncidents: IncidentRecord[] = [];
  private readonly maxResolved = 5000;

  /**
   * 장애 시작 기록
   * AlertManager firing 이벤트 수신 시 호출
   */
  recordIncidentStart(service: string, team: string, startsAt: string): void {
    const key = this.makeKey(service, team);

    // 이미 활성 장애가 있으면 중복 방지
    if (this.activeIncidents.has(key)) {
      return;
    }

    this.activeIncidents.set(key, {
      service,
      team,
      startedAt: new Date(startsAt).getTime(),
      resolvedAt: null,
      mttrSeconds: null,
    });
  }

  /**
   * 장애 해결 기록 및 MTTR 계산
   * AlertManager resolved 이벤트 수신 시 호출
   * @returns 복구 시간(초) 또는 활성 장애가 없으면 null
   */
  recordIncidentEnd(service: string, team: string, endsAt: string): number | null {
    const key = this.makeKey(service, team);
    const incident = this.activeIncidents.get(key);

    if (!incident) {
      return null;
    }

    const resolvedAt = new Date(endsAt).getTime();
    const mttrSeconds = (resolvedAt - incident.startedAt) / 1000;

    incident.resolvedAt = resolvedAt;
    incident.mttrSeconds = Math.max(0, mttrSeconds);

    // 활성 목록에서 제거, 해결 목록에 추가
    this.activeIncidents.delete(key);
    this.resolvedIncidents.push(incident);

    // 메모리 관리
    if (this.resolvedIncidents.length > this.maxResolved) {
      this.resolvedIncidents = this.resolvedIncidents.slice(-this.maxResolved);
    }

    return incident.mttrSeconds;
  }

  /**
   * 팀별 중앙값 MTTR (초)
   */
  getMedianMTTR(team: string): number {
    const teamRecords = this.resolvedIncidents
      .filter(r => r.team === team && r.mttrSeconds !== null)
      .map(r => r.mttrSeconds!)
      .sort((a, b) => a - b);

    if (teamRecords.length === 0) return 0;

    const mid = Math.floor(teamRecords.length / 2);
    if (teamRecords.length % 2 === 0) {
      return (teamRecords[mid - 1] + teamRecords[mid]) / 2;
    }
    return teamRecords[mid];
  }

  /**
   * 팀별 평균 MTTR (초)
   */
  getAverageMTTR(team: string): number {
    const teamRecords = this.resolvedIncidents
      .filter(r => r.team === team && r.mttrSeconds !== null);

    if (teamRecords.length === 0) return 0;

    const sum = teamRecords.reduce((acc, r) => acc + r.mttrSeconds!, 0);
    return sum / teamRecords.length;
  }

  /**
   * 현재 활성 장애 수
   */
  getActiveIncidentCount(): number {
    return this.activeIncidents.size;
  }

  /**
   * 해결된 장애 총 수
   */
  getResolvedCount(): number {
    return this.resolvedIncidents.length;
  }

  private makeKey(service: string, team: string): string {
    return `${service}:${team}`;
  }
}
