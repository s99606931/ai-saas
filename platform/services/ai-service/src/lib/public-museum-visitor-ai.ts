// Design Ref: §공공 박물관 방문자 AI — 방문 패턴 분석 및 전시 추천
// Plan SC: FR-R602.1~6

const DATA_GRADE_BLOCK = ['C', 'S'] as const;
type DataGrade = 'C' | 'S' | 'O';

function blockClassifiedData(grade: DataGrade): void {
  if ((DATA_GRADE_BLOCK as readonly string[]).includes(grade)) {
    throw new Error(`BLOCKED: ${grade}등급 데이터는 AI API 전송 금지 (N2SF N-05)`);
  }
}

export type ExhibitCategory = 'history' | 'art' | 'science' | 'culture' | 'nature';

export interface Exhibit {
  exhibitId: string;
  title: string;
  category: ExhibitCategory;
  avgDwellTimeMin: number;
  popularity: number; // 0~100
}

export interface VisitRecord {
  visitorId: string;
  exhibitId: string;
  dwellTimeMin: number;
}

export interface Recommendation {
  exhibitId: string;
  score: number;
  reason: string;
}

interface AuditEntry {
  timestamp: string;
  action: string;
  detail: Record<string, unknown>;
}

export class PublicMuseumVisitorAI {
  private exhibits = new Map<string, Exhibit>();
  private visits: VisitRecord[] = [];
  private auditLog: AuditEntry[] = [];

  private append(action: string, detail: Record<string, unknown>): void {
    this.auditLog.push({ timestamp: new Date().toISOString(), action, detail });
  }

  // Plan SC: FR-R602.1
  registerExhibit(exhibit: Exhibit, grade: DataGrade = 'O'): void {
    blockClassifiedData(grade);
    if (exhibit.popularity < 0 || exhibit.popularity > 100) {
      throw new Error('인기도는 0~100 범위여야 합니다');
    }
    if (exhibit.avgDwellTimeMin < 0) throw new Error('평균 관람 시간은 0 이상이어야 합니다');
    this.exhibits.set(exhibit.exhibitId, { ...exhibit });
    this.append('REGISTER_EXHIBIT', { exhibitId: exhibit.exhibitId });
  }

  // Plan SC: FR-R602.2
  recordVisit(visit: VisitRecord, grade: DataGrade = 'O'): void {
    blockClassifiedData(grade);
    if (!this.exhibits.has(visit.exhibitId)) throw new Error(`전시 미등록: ${visit.exhibitId}`);
    if (visit.dwellTimeMin < 0) throw new Error('관람 시간은 0 이상이어야 합니다');
    this.visits.push({ ...visit });
    this.append('RECORD_VISIT', { visitorId: visit.visitorId, exhibitId: visit.exhibitId });
  }

  // Plan SC: FR-R602.3
  recommend(visitorId: string, topK = 3): Recommendation[] {
    const visited = new Set(this.visits.filter(v => v.visitorId === visitorId).map(v => v.exhibitId));
    const visitorCategories = new Set<ExhibitCategory>();
    for (const v of this.visits.filter(v => v.visitorId === visitorId)) {
      const ex = this.exhibits.get(v.exhibitId);
      if (ex) visitorCategories.add(ex.category);
    }

    const scored: Recommendation[] = [];
    for (const ex of this.exhibits.values()) {
      if (visited.has(ex.exhibitId)) continue;
      const categoryMatch = visitorCategories.has(ex.category) ? 30 : 0;
      const popularityScore = ex.popularity * 0.5;
      const score = Math.round((categoryMatch + popularityScore) * 100) / 100;
      const reason = categoryMatch > 0 ? '관심 카테고리 일치' : '높은 인기도';
      scored.push({ exhibitId: ex.exhibitId, score, reason });
    }
    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, topK);
  }

  // Plan SC: FR-R602.4
  popularExhibits(topK = 5): Exhibit[] {
    return Array.from(this.exhibits.values())
      .sort((a, b) => b.popularity - a.popularity)
      .slice(0, topK)
      .map(e => ({ ...e }));
  }

  // Plan SC: FR-R602.5
  avgDwellByCategory(): Record<ExhibitCategory, number> {
    const sum: Record<ExhibitCategory, number> = {
      history: 0,
      art: 0,
      science: 0,
      culture: 0,
      nature: 0,
    };
    const count: Record<ExhibitCategory, number> = {
      history: 0,
      art: 0,
      science: 0,
      culture: 0,
      nature: 0,
    };
    for (const v of this.visits) {
      const ex = this.exhibits.get(v.exhibitId);
      if (!ex) continue;
      sum[ex.category] += v.dwellTimeMin;
      count[ex.category]++;
    }
    const result: Record<ExhibitCategory, number> = {
      history: 0,
      art: 0,
      science: 0,
      culture: 0,
      nature: 0,
    };
    (Object.keys(sum) as ExhibitCategory[]).forEach(k => {
      result[k] = count[k] === 0 ? 0 : Math.round((sum[k] / count[k]) * 100) / 100;
    });
    return result;
  }

  // Plan SC: FR-R602.6
  getAuditLog(): AuditEntry[] {
    return [...this.auditLog];
  }
}
