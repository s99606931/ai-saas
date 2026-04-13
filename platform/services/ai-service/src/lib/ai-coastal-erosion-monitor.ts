// Design Ref: §해안 침식 모니터링 — 해안선 시계열 변화율 탐지
// Plan SC: FR-R565.1~6

const DATA_GRADE_BLOCK = ['C', 'S'] as const;
type DataGrade = 'C' | 'S' | 'O';

function blockClassifiedData(grade: DataGrade): void {
  if ((DATA_GRADE_BLOCK as readonly string[]).includes(grade)) {
    throw new Error(`BLOCKED: ${grade}등급 데이터는 AI API 전송 금지 (N2SF N-05)`);
  }
}

export interface CoastlineReading {
  siteId: string;
  at: string; // ISO
  shorelineMeters: number; // 기준선 대비 해안선 거리
  beachWidthMeters: number;
  waveHeightMeters: number;
}

export interface ErosionAssessment {
  siteId: string;
  retreatRateMPerYear: number;
  severity: 'stable' | 'watch' | 'warning' | 'critical';
  projectedLossMetersIn10Y: number;
  actions: string[];
}

interface AuditEntry {
  timestamp: string;
  action: string;
  detail: Record<string, unknown>;
}

export class CoastalErosionMonitor {
  private readonly readings = new Map<string, CoastlineReading[]>();
  private readonly auditLog: AuditEntry[] = [];

  private append(action: string, detail: Record<string, unknown>): void {
    this.auditLog.push({ timestamp: new Date().toISOString(), action, detail });
  }

  // Plan SC: FR-R565.1
  addReading(reading: CoastlineReading, grade: DataGrade = 'O'): void {
    blockClassifiedData(grade);
    if (reading.shorelineMeters < 0 || reading.beachWidthMeters < 0) {
      throw new Error('거리 값은 0 이상이어야 합니다');
    }
    if (reading.waveHeightMeters < 0) throw new Error('파고는 0 이상이어야 합니다');
    const list = this.readings.get(reading.siteId) ?? [];
    list.push({ ...reading });
    list.sort((a, b) => a.at.localeCompare(b.at));
    this.readings.set(reading.siteId, list);
    this.append('ADD_READING', { siteId: reading.siteId, at: reading.at });
  }

  // Plan SC: FR-R565.2
  private yearsBetween(a: string, b: string): number {
    const ms = new Date(b).getTime() - new Date(a).getTime();
    return ms / (1000 * 60 * 60 * 24 * 365.25);
  }

  // Plan SC: FR-R565.3
  assess(siteId: string, grade: DataGrade = 'O'): ErosionAssessment {
    blockClassifiedData(grade);
    const list = this.readings.get(siteId);
    if (!list || list.length < 2) {
      throw new Error(`시계열 데이터 부족: ${siteId} (최소 2개 필요)`);
    }
    const first = list[0]!;
    const last = list[list.length - 1]!;
    const years = this.yearsBetween(first.at, last.at);
    if (years <= 0) throw new Error('유효한 시간 간격이 필요합니다');

    const retreat = first.shorelineMeters - last.shorelineMeters;
    const rate = Math.round((retreat / years) * 1000) / 1000;

    const severity: ErosionAssessment['severity'] =
      rate >= 3 ? 'critical' : rate >= 1.5 ? 'warning' : rate >= 0.5 ? 'watch' : 'stable';

    const actions: string[] = [];
    if (severity === 'watch') actions.push('정기 모니터링 강화');
    if (severity === 'warning') {
      actions.push('양빈 사업 검토');
      actions.push('해안 식생 복원');
    }
    if (severity === 'critical') {
      actions.push('긴급 방파제 설치 검토');
      actions.push('주민 대피 계획 수립');
    }
    if (last.waveHeightMeters > 3) actions.push('고파랑 대비 모니터링 증가');

    const projected = Math.max(0, Math.round(rate * 10 * 1000) / 1000);

    const result: ErosionAssessment = {
      siteId,
      retreatRateMPerYear: rate,
      severity,
      projectedLossMetersIn10Y: projected,
      actions,
    };
    this.append('ASSESS', { siteId, severity, rate });
    return result;
  }

  // Plan SC: FR-R565.4
  listSites(): string[] {
    return Array.from(this.readings.keys());
  }

  // Plan SC: FR-R565.5
  getReadings(siteId: string): CoastlineReading[] {
    const list = this.readings.get(siteId);
    return list ? list.map(r => ({ ...r })) : [];
  }

  // Plan SC: FR-R565.6
  getAuditLog(): AuditEntry[] {
    return [...this.auditLog];
  }
}
