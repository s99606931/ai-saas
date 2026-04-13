// Design Ref: §핵심 알고리즘 — 관광지별 방문 통계 및 계절성 분석
// Plan SC: FR-R518.1~5

const DATA_GRADE_BLOCK = ['C', 'S'] as const;
type DataGrade = 'C' | 'S' | 'O';

function blockClassifiedData(grade: DataGrade): void {
  if ((DATA_GRADE_BLOCK as readonly string[]).includes(grade)) {
    throw new Error(`BLOCKED: ${grade}등급 데이터는 AI API 전송 금지 (N2SF N-05)`);
  }
}

interface VisitRecord {
  attractionId: string;
  region: string;
  monthYYYYMM: string;
  visitorCount: number;
  averageStayHours: number;
  averageSpendKrw: number;
}

interface SeasonalityReport {
  attractionId: string;
  peakMonth: string;
  lowMonth: string;
  variance: number;
  seasonalityIndex: number; // 0 ~ 1
}

interface RegionalSummary {
  region: string;
  totalVisitors: number;
  totalRevenueKrw: number;
  averageStayHours: number;
}

interface AuditEntry {
  timestamp: string;
  action: string;
  detail: Record<string, unknown>;
}

export class GovTourismAnalyticsAI {
  private records: VisitRecord[] = [];
  private readonly auditLog: AuditEntry[] = [];

  private appendAudit(action: string, detail: Record<string, unknown>): void {
    this.auditLog.push({ timestamp: new Date().toISOString(), action, detail });
  }

  // Plan SC: FR-R518.1
  recordVisit(record: VisitRecord, grade: DataGrade = 'O'): void {
    blockClassifiedData(grade);
    if (record.visitorCount < 0) throw new Error('visitorCount >= 0 필요');
    this.records.push(record);
    this.appendAudit('RECORD_VISIT', { attractionId: record.attractionId, monthYYYYMM: record.monthYYYYMM });
  }

  // Plan SC: FR-R518.2
  computeSeasonality(attractionId: string): SeasonalityReport {
    const subset = this.records.filter(r => r.attractionId === attractionId);
    if (subset.length < 2) throw new Error(`데이터 부족: ${attractionId}`);

    let peakMonth = subset[0]!.monthYYYYMM;
    let lowMonth = subset[0]!.monthYYYYMM;
    let peakCount = subset[0]!.visitorCount;
    let lowCount = subset[0]!.visitorCount;

    for (const r of subset) {
      if (r.visitorCount > peakCount) {
        peakCount = r.visitorCount;
        peakMonth = r.monthYYYYMM;
      }
      if (r.visitorCount < lowCount) {
        lowCount = r.visitorCount;
        lowMonth = r.monthYYYYMM;
      }
    }

    const mean = subset.reduce((s, r) => s + r.visitorCount, 0) / subset.length;
    const variance = subset.reduce((s, r) => s + Math.pow(r.visitorCount - mean, 2), 0) / subset.length;
    const stdDev = Math.sqrt(variance);
    const seasonalityIndex = mean > 0 ? Math.min(1, stdDev / mean) : 0;

    this.appendAudit('COMPUTE_SEASONALITY', { attractionId, peakMonth, lowMonth });
    return {
      attractionId,
      peakMonth,
      lowMonth,
      variance: Math.round(variance),
      seasonalityIndex: Math.round(seasonalityIndex * 100) / 100,
    };
  }

  // Plan SC: FR-R518.3
  computeRegionalSummary(region: string, monthYYYYMM: string): RegionalSummary {
    const subset = this.records.filter(r => r.region === region && r.monthYYYYMM === monthYYYYMM);
    if (subset.length === 0) {
      return { region, totalVisitors: 0, totalRevenueKrw: 0, averageStayHours: 0 };
    }

    const totalVisitors = subset.reduce((s, r) => s + r.visitorCount, 0);
    const totalRevenueKrw = subset.reduce((s, r) => s + r.visitorCount * r.averageSpendKrw, 0);
    const totalHours = subset.reduce((s, r) => s + r.averageStayHours * r.visitorCount, 0);
    const averageStayHours = totalVisitors > 0 ? Math.round((totalHours / totalVisitors) * 10) / 10 : 0;

    this.appendAudit('REGIONAL_SUMMARY', { region, monthYYYYMM, totalVisitors });
    return { region, totalVisitors, totalRevenueKrw, averageStayHours };
  }

  // Plan SC: FR-R518.4
  rankAttractions(monthYYYYMM: string, topN: number = 5): Array<{ attractionId: string; visitors: number }> {
    const subset = this.records.filter(r => r.monthYYYYMM === monthYYYYMM);
    const map = new Map<string, number>();
    for (const r of subset) {
      map.set(r.attractionId, (map.get(r.attractionId) ?? 0) + r.visitorCount);
    }
    return Array.from(map.entries())
      .map(([attractionId, visitors]) => ({ attractionId, visitors }))
      .sort((a, b) => b.visitors - a.visitors)
      .slice(0, topN);
  }

  // Plan SC: FR-R518.5
  getAuditLog(): AuditEntry[] {
    return [...this.auditLog];
  }
}
