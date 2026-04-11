// 공공 여론 수집/종합 분석 -- FR-N342.1~FR-N342.4
// Design Ref: MTU-N342 | CSAP: D-06, D-08

export interface OpinionEntry { readonly entryId: string; readonly channel: string; readonly content: string; readonly topic: string; readonly sentiment: 'positive' | 'negative' | 'neutral'; readonly timestamp: string; }
export interface TopicCluster { readonly topic: string; readonly count: number; readonly sentimentBreakdown: { positive: number; negative: number; neutral: number }; readonly keywords: readonly string[]; }
export interface OpinionReport { readonly reportId: string; readonly tenantId: string; readonly totalEntries: number; readonly clusters: readonly TopicCluster[]; readonly dominantSentiment: string; readonly generatedAt: string; }
export interface OpinionAuditEntry { readonly timestamp: string; readonly actor: string; readonly tenantId: string; readonly action: string; readonly target: string; readonly details: Record<string, unknown>; }

const auditLog: OpinionAuditEntry[] = [];
function recordAudit(entry: Omit<OpinionAuditEntry, 'timestamp'>): void { auditLog.push({ ...entry, timestamp: new Date().toISOString() }); }
export function getOpinionAuditLog(tenantId: string): readonly OpinionAuditEntry[] { return auditLog.filter(e => e.tenantId === tenantId); }

export function collectOpinion(channel: string, content: string, topic: string, sentiment: OpinionEntry['sentiment']): OpinionEntry {
  return { entryId: `op-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, channel, content, topic, sentiment, timestamp: new Date().toISOString() };
}

export function clusterByTopic(entries: OpinionEntry[]): TopicCluster[] {
  const groups = new Map<string, OpinionEntry[]>();
  for (const e of entries) { const g = groups.get(e.topic) ?? []; g.push(e); groups.set(e.topic, g); }
  const clusters: TopicCluster[] = [];
  for (const [topic, items] of groups.entries()) {
    const pos = items.filter(i => i.sentiment === 'positive').length;
    const neg = items.filter(i => i.sentiment === 'negative').length;
    const neu = items.filter(i => i.sentiment === 'neutral').length;
    const words = new Set<string>();
    for (const i of items) { for (const w of i.content.split(/\s+/).filter(w => w.length > 1)) words.add(w); }
    clusters.push({ topic, count: items.length, sentimentBreakdown: { positive: pos, negative: neg, neutral: neu }, keywords: [...words].slice(0, 10) });
  }
  return clusters.sort((a, b) => b.count - a.count);
}

export function generateOpinionReport(tenantId: string, entries: OpinionEntry[]): OpinionReport {
  const clusters = clusterByTopic(entries);
  const pos = entries.filter(e => e.sentiment === 'positive').length;
  const neg = entries.filter(e => e.sentiment === 'negative').length;
  const dominant = pos > neg ? 'positive' : neg > pos ? 'negative' : 'neutral';
  recordAudit({ actor: 'system', tenantId, action: 'OPINION_REPORT_GENERATED', target: tenantId, details: { entries: entries.length, topics: clusters.length, dominant } });
  return { reportId: `opr-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, tenantId, totalEntries: entries.length, clusters, dominantSentiment: dominant, generatedAt: new Date().toISOString() };
}

export class PublicOpinionAggregatorService {
  constructor(private readonly tenantId: string) {}
  collect(channel: string, content: string, topic: string, sentiment: OpinionEntry['sentiment']): OpinionEntry { return collectOpinion(channel, content, topic, sentiment); }
  cluster(entries: OpinionEntry[]): TopicCluster[] { return clusterByTopic(entries); }
  report(entries: OpinionEntry[]): OpinionReport { return generateOpinionReport(this.tenantId, entries); }
  getAuditLog(): readonly OpinionAuditEntry[] { return getOpinionAuditLog(this.tenantId); }
}
