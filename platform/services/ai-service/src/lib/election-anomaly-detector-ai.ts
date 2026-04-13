// Design Ref: §선거 이상 탐지 — 투표율·득표율 편차 기반 이상 감지
// Plan SC: FR-R547.1~6

const DATA_GRADE_BLOCK = ['C', 'S'] as const;
type DataGrade = 'C' | 'S' | 'O';

function blockClassifiedData(grade: DataGrade): void {
  if ((DATA_GRADE_BLOCK as readonly string[]).includes(grade)) {
    throw new Error(`BLOCKED: ${grade}등급 데이터는 AI API 전송 금지 (N2SF N-05)`);
  }
}

export interface PollingStation {
  stationId: string;
  region: string;
  eligibleVoters: number;
  totalVotes: number;
  candidateVotes: Record<string, number>;
}

export interface AnomalyReport {
  stationId: string;
  anomalyScore: number; // 0~100
  reasons: string[];
  severity: 'normal' | 'watch' | 'alert';
}

interface AuditEntry {
  timestamp: string;
  action: string;
  detail: Record<string, unknown>;
}

export class ElectionAnomalyDetectorAI {
  private stations = new Map<string, PollingStation>();
  private auditLog: AuditEntry[] = [];

  private append(action: string, detail: Record<string, unknown>): void {
    this.auditLog.push({ timestamp: new Date().toISOString(), action, detail });
  }

  // Plan SC: FR-R547.1
  registerStation(station: PollingStation, grade: DataGrade = 'O'): void {
    blockClassifiedData(grade);
    if (station.eligibleVoters <= 0) throw new Error('유권자 수는 양수여야 합니다');
    if (station.totalVotes < 0) throw new Error('투표 수는 0 이상이어야 합니다');
    if (station.totalVotes > station.eligibleVoters) {
      throw new Error('투표 수가 유권자 수를 초과할 수 없습니다');
    }
    const sum = Object.values(station.candidateVotes).reduce((s, v) => s + v, 0);
    if (sum > station.totalVotes) throw new Error('후보자 득표 합계가 총 투표 수를 초과합니다');
    this.stations.set(station.stationId, {
      ...station,
      candidateVotes: { ...station.candidateVotes },
    });
    this.append('REGISTER_STATION', { stationId: station.stationId });
  }

  // Plan SC: FR-R547.2
  turnoutPct(stationId: string): number {
    const s = this.stations.get(stationId);
    if (!s) throw new Error(`투표소 미등록: ${stationId}`);
    return Math.round((s.totalVotes / s.eligibleVoters) * 10000) / 100;
  }

  // Plan SC: FR-R547.3
  regionalAverageTurnout(region: string): number {
    const list = Array.from(this.stations.values()).filter(s => s.region === region);
    if (list.length === 0) return 0;
    const sum = list.reduce((acc, s) => acc + (s.totalVotes / s.eligibleVoters) * 100, 0);
    return Math.round((sum / list.length) * 100) / 100;
  }

  // Plan SC: FR-R547.4
  detect(stationId: string, grade: DataGrade = 'O'): AnomalyReport {
    blockClassifiedData(grade);
    const s = this.stations.get(stationId);
    if (!s) throw new Error(`투표소 미등록: ${stationId}`);
    const reasons: string[] = [];
    const turnout = this.turnoutPct(stationId);
    const regionAvg = this.regionalAverageTurnout(s.region);

    let score = 0;
    const deviation = Math.abs(turnout - regionAvg);
    if (deviation > 15) {
      score += 40;
      reasons.push('TURNOUT_DEVIATION');
    }
    if (turnout > 99) {
      score += 30;
      reasons.push('UNREALISTIC_TURNOUT');
    }
    const votes = Object.values(s.candidateVotes);
    if (votes.length > 0) {
      const maxV = Math.max(...votes);
      if (s.totalVotes > 0 && maxV / s.totalVotes > 0.95) {
        score += 30;
        reasons.push('EXTREME_CANDIDATE_DOMINANCE');
      }
    }

    const severity: 'normal' | 'watch' | 'alert' = score >= 60 ? 'alert' : score >= 30 ? 'watch' : 'normal';
    const report: AnomalyReport = { stationId, anomalyScore: score, reasons, severity };
    this.append('DETECT', { stationId, severity });
    return report;
  }

  // Plan SC: FR-R547.5
  listAlerts(): string[] {
    const alerts: string[] = [];
    for (const [id] of this.stations) {
      if (this.detect(id).severity === 'alert') alerts.push(id);
    }
    return alerts;
  }

  // Plan SC: FR-R547.6
  getAuditLog(): AuditEntry[] {
    return [...this.auditLog];
  }
}
