// Design Ref: §유산 관광 방문 최적화 + 수용력 관리
// Plan SC: FR-R619.1~5

enum DataGrade { C = 'C', S = 'S', O = 'O' }

type HeritageCategory = 'temple' | 'palace' | 'museum' | 'natural' | 'historic_site';

interface HeritageSite {
  id: string;
  name: string;
  category: HeritageCategory;
  dailyCapacity: number;
  averageVisitMinutes: number;
  popularityScore: number;
}

interface VisitorRecord {
  siteId: string;
  date: string;
  visitorCount: number;
}

interface TourRecommendation {
  tourId: string;
  siteOrder: string[];
  estimatedTotalMinutes: number;
  crowdingRisk: 'low' | 'moderate' | 'high';
}

interface AuditEntry {
  timestamp: string;
  action: string;
  detail: Record<string, unknown>;
}

function blockClassifiedData(grade: DataGrade): void {
  if (grade === DataGrade.C || grade === DataGrade.S) {
    throw new Error(`BLOCKED: ${grade}등급 데이터는 AI API 전송 금지 (N2SF N-05)`);
  }
}

export class AIHeritageTourismOptimizer {
  private sites = new Map<string, HeritageSite>();
  private visitors: VisitorRecord[] = [];
  private readonly audit: AuditEntry[] = [];

  private log(action: string, detail: Record<string, unknown>): void {
    this.audit.push({ timestamp: new Date().toISOString(), action, detail });
  }

  // Plan SC: FR-R619.1
  registerSite(site: HeritageSite): void {
    if (site.dailyCapacity <= 0) throw new Error('수용력은 양수여야 합니다');
    this.sites.set(site.id, site);
    this.log('REGISTER_SITE', { id: site.id, category: site.category });
  }

  // Plan SC: FR-R619.2
  recordVisit(record: VisitorRecord, grade: DataGrade = DataGrade.O): void {
    blockClassifiedData(grade);
    if (!this.sites.has(record.siteId)) throw new Error(`사이트 미등록: ${record.siteId}`);
    if (record.visitorCount < 0) throw new Error('방문객 수는 음수일 수 없음');
    this.visitors.push(record);
    this.log('RECORD_VISIT', { siteId: record.siteId, count: record.visitorCount });
  }

  // Plan SC: FR-R619.3
  private occupancyRatio(siteId: string, date: string): number {
    const site = this.sites.get(siteId);
    if (!site) return 0;
    const total = this.visitors
      .filter(v => v.siteId === siteId && v.date === date)
      .reduce((a, v) => a + v.visitorCount, 0);
    return total / site.dailyCapacity;
  }

  private crowdingLevel(ratio: number): TourRecommendation['crowdingRisk'] {
    if (ratio >= 0.85) return 'high';
    if (ratio >= 0.6) return 'moderate';
    return 'low';
  }

  // Plan SC: FR-R619.4
  recommendTour(
    candidateSites: string[],
    date: string,
    grade: DataGrade = DataGrade.O,
  ): TourRecommendation {
    blockClassifiedData(grade);
    const scored: Array<{ id: string; site: HeritageSite; score: number }> = [];
    for (const id of candidateSites) {
      const site = this.sites.get(id);
      if (!site) continue;
      const occupancy = this.occupancyRatio(id, date);
      // 점수 = 인기도 - 혼잡도 패널티
      const score = site.popularityScore - occupancy * 50;
      scored.push({ id, site, score });
    }

    scored.sort((a, b) => b.score - a.score);
    const order = scored.map(s => s.id);
    const totalMinutes = scored.reduce((acc, s) => acc + s.site.averageVisitMinutes, 0)
      + Math.max(0, (scored.length - 1) * 30); // 이동시간

    const avgOccupancy = scored.length === 0
      ? 0
      : scored.reduce((acc, s) => acc + this.occupancyRatio(s.id, date), 0) / scored.length;

    const tour: TourRecommendation = {
      tourId: `tour-${Date.now()}`,
      siteOrder: order,
      estimatedTotalMinutes: totalMinutes,
      crowdingRisk: this.crowdingLevel(avgOccupancy),
    };
    this.log('RECOMMEND_TOUR', { count: order.length, risk: tour.crowdingRisk });
    return tour;
  }

  // Plan SC: FR-R619.5
  getSiteOccupancy(siteId: string, date: string): number {
    return Math.round(this.occupancyRatio(siteId, date) * 100) / 100;
  }

  getAuditLog(): readonly AuditEntry[] {
    return this.audit;
  }
}
