// SVC-AI-ADV-R397 Social Media Monitor AI
// Design Ref: SVC-AI-ADV-R397.design.md
// Plan SC: SC-R397-1~5
// CSAP D-06 / N2SF N-05

export type DataGrade = 'O' | 'C' | 'S';

export type PostCategory = 'crisis' | 'complaint' | 'positive' | 'neutral';
export type AlertLevel = 'low' | 'med' | 'high';

const CRISIS_KEYWORDS = ['폭발', '화재', '사고', '붕괴', '사망'];
const COMPLAINT_KEYWORDS = ['불만', '항의', '환불', '무능', '실망'];
const POSITIVE_KEYWORDS = ['좋다', '감사', '훌륭', '만족'];

export interface PostAnalysis {
  readonly postId: string;
  readonly score: number;
  readonly category: PostCategory;
  readonly crisisCount: number;
  readonly complaintCount: number;
  readonly positiveCount: number;
}

export interface MonitorReport {
  readonly analyses: readonly PostAnalysis[];
  readonly alertLevel: AlertLevel;
}

export interface AuditEntry {
  readonly timestamp: string;
  readonly action: string;
  readonly target: string;
  readonly details: Record<string, unknown>;
}

export class SocialMediaMonitorAI {
  private readonly auditLog: AuditEntry[] = [];

  analyze(
    posts: readonly { id: string; text: string }[],
    grade: DataGrade = 'O',
  ): MonitorReport {
    if (grade === 'C' || grade === 'S') {
      throw new Error(`N2SF_BLOCKED: ${grade}등급 소셜 데이터 차단 (N2SF N-05)`);
    }

    const analyses: PostAnalysis[] = posts.map((p) => {
      const crisisCount = this.countHits(p.text, CRISIS_KEYWORDS);
      const complaintCount = this.countHits(p.text, COMPLAINT_KEYWORDS);
      const positiveCount = this.countHits(p.text, POSITIVE_KEYWORDS);

      const raw = positiveCount * 20 - complaintCount * 30 - crisisCount * 50;
      const score = Math.max(-100, Math.min(100, raw));

      let category: PostCategory;
      if (crisisCount >= 1) category = 'crisis';
      else if (complaintCount >= 1) category = 'complaint';
      else if (positiveCount >= 1) category = 'positive';
      else category = 'neutral';

      return { postId: p.id, score, category, crisisCount, complaintCount, positiveCount };
    });

    const totalCrisis = analyses.reduce((s, a) => s + a.crisisCount, 0);
    const totalComplaint = analyses.reduce((s, a) => s + a.complaintCount, 0);

    let alertLevel: AlertLevel;
    if (totalCrisis >= 2) alertLevel = 'high';
    else if (totalCrisis >= 1 || totalComplaint >= 3) alertLevel = 'med';
    else alertLevel = 'low';

    this.record('ANALYZE', 'social', { count: posts.length, alertLevel });
    return { analyses, alertLevel };
  }

  getAuditLog(): readonly AuditEntry[] {
    return this.auditLog;
  }

  private countHits(text: string, keywords: readonly string[]): number {
    return keywords.reduce((n, k) => n + (text.includes(k) ? 1 : 0), 0);
  }

  private record(action: string, target: string, details: Record<string, unknown>): void {
    this.auditLog.push({
      timestamp: new Date().toISOString(),
      action,
      target,
      details,
    });
  }
}
