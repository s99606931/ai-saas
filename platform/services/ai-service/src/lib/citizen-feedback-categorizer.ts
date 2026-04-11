// 시민 피드백 자동 분류 -- FR-N358.1~FR-N358.4
// Design Ref: MTU-N358 | CSAP: D-06, D-08

export interface FeedbackCategory { readonly categoryId: string; readonly name: string; readonly keywords: readonly string[]; readonly priority: number; }
export interface FeedbackItem { readonly feedbackId: string; readonly content: string; readonly source: string; readonly submittedAt: string; }
export interface CategorizedFeedback { readonly feedbackId: string; readonly content: string; readonly category: string; readonly confidence: number; readonly priority: number; }
export interface FeedbackAuditEntry { readonly timestamp: string; readonly actor: string; readonly tenantId: string; readonly action: string; readonly target: string; readonly details: Record<string, unknown>; }

const auditLog: FeedbackAuditEntry[] = [];
function recordAudit(entry: Omit<FeedbackAuditEntry, 'timestamp'>): void { auditLog.push({ ...entry, timestamp: new Date().toISOString() }); }
export function getFeedbackAuditLog(tenantId: string): readonly FeedbackAuditEntry[] { return auditLog.filter(e => e.tenantId === tenantId); }

const categoryStore: FeedbackCategory[] = [];

export function defineCategory(name: string, keywords: string[], priority: number = 0): FeedbackCategory {
  const cat: FeedbackCategory = { categoryId: `fcat-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, name, keywords, priority };
  categoryStore.push(cat);
  return cat;
}

export function categorize(feedback: FeedbackItem): CategorizedFeedback {
  const lower = feedback.content.toLowerCase();
  let bestCat = '미분류';
  let bestScore = 0;
  let bestPriority = 0;
  for (const cat of categoryStore) {
    const matches = cat.keywords.filter(k => lower.includes(k.toLowerCase())).length;
    if (matches > bestScore) { bestScore = matches; bestCat = cat.name; bestPriority = cat.priority; }
  }
  const confidence = bestScore > 0 ? Math.min(1, bestScore * 0.25 + 0.3) : 0.1;
  return { feedbackId: feedback.feedbackId, content: feedback.content, category: bestCat, confidence, priority: bestPriority };
}

export function categorizeBatch(tenantId: string, feedbacks: FeedbackItem[]): CategorizedFeedback[] {
  const results = feedbacks.map(f => categorize(f));
  recordAudit({ actor: 'system', tenantId, action: 'FEEDBACK_CATEGORIZED', target: tenantId, details: { count: feedbacks.length } });
  return results.sort((a, b) => b.priority - a.priority);
}

export class CitizenFeedbackCategorizerService {
  constructor(private readonly tenantId: string) {}
  define(name: string, keywords: string[], priority?: number): FeedbackCategory { return defineCategory(name, keywords, priority); }
  categorize(feedback: FeedbackItem): CategorizedFeedback { return categorize(feedback); }
  batch(feedbacks: FeedbackItem[]): CategorizedFeedback[] { return categorizeBatch(this.tenantId, feedbacks); }
  getAuditLog(): readonly FeedbackAuditEntry[] { return getFeedbackAuditLog(this.tenantId); }
}
