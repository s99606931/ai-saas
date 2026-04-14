// Design Ref: §SVC-AI-ADV-R480 — AI기반 공공기관 민원 자동 분류 v3
// Plan SC: FR-R480.1~5

export type Urgency = 'low' | 'normal' | 'high' | 'emergency';
export type ComplaintCategory = 'TRAFFIC' | 'ENVIRONMENT' | 'WELFARE' | 'SAFETY' | 'OTHER';

export interface Complaint {
  readonly complaintId: string;
  readonly content: string;
  readonly submitterId: string;
  readonly urgency: Urgency;
}

export interface ClassifiedComplaint {
  readonly complaintId: string;
  readonly category: ComplaintCategory;
  readonly priority: number;
  readonly maskedSubmitterId: string;
}

const CATEGORY_KEYWORDS: Array<{ keywords: readonly string[]; category: ComplaintCategory }> = [
  { keywords: ['도로', '교통', '버스', '신호', '주차'], category: 'TRAFFIC' },
  { keywords: ['환경', '쓰레기', '소음', '악취', '오염'], category: 'ENVIRONMENT' },
  { keywords: ['복지', '노인', '장애', '의료', '지원'], category: 'WELFARE' },
  { keywords: ['안전', '화재', '범죄', '위험', '사고'], category: 'SAFETY' },
];

const PRIORITY: Record<Urgency, number> = {
  emergency: 1,
  high: 2,
  normal: 3,
  low: 4,
};

interface AuditEvent {
  timestamp: string;
  action: string;
  details: Record<string, unknown>;
}

export class PublicComplaintClassifierV3 {
  private readonly auditLog: AuditEvent[] = [];

  private maskId(id: string): string {
    if (id.length < 4) return '***';
    return id.slice(0, 2) + '*'.repeat(id.length - 4) + id.slice(-2);
  }

  private classify(content: string): ComplaintCategory {
    for (const { keywords, category } of CATEGORY_KEYWORDS) {
      if (keywords.some(kw => content.includes(kw))) return category;
    }
    return 'OTHER';
  }

  classify_complaints(complaints: readonly Complaint[]): readonly ClassifiedComplaint[] {
    const results: ClassifiedComplaint[] = complaints.map(c => ({
      complaintId: c.complaintId,
      category: this.classify(c.content),
      priority: PRIORITY[c.urgency],
      maskedSubmitterId: this.maskId(c.submitterId),
    }));

    this.auditLog.push({
      timestamp: new Date().toISOString(),
      action: 'complaint.classify',
      details: {
        total: complaints.length,
        emergency: results.filter(r => r.priority === 1).length,
      },
    });

    return results;
  }

  getAuditLog(): readonly AuditEvent[] {
    return [...this.auditLog];
  }
}
