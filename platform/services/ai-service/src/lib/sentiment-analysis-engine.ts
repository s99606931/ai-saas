// 민원/여론 감성 분석 엔진 -- FR-N326.1~FR-N326.4
// Design Ref: MTU-N326 | CSAP: D-06, D-08

export interface SentimentInput { readonly textId: string; readonly text: string; readonly source: string; readonly category: string; }
export interface SentimentResult { readonly textId: string; readonly sentiment: 'positive' | 'negative' | 'neutral'; readonly score: number; readonly confidence: number; readonly keywords: readonly string[]; }
export interface SentimentTrend { readonly period: string; readonly positive: number; readonly negative: number; readonly neutral: number; readonly averageScore: number; }
export interface SentimentAuditEntry { readonly timestamp: string; readonly actor: string; readonly tenantId: string; readonly action: string; readonly target: string; readonly details: Record<string, unknown>; }

const auditLog: SentimentAuditEntry[] = [];
function recordAudit(entry: Omit<SentimentAuditEntry, 'timestamp'>): void { auditLog.push({ ...entry, timestamp: new Date().toISOString() }); }
export function getSentimentAuditLog(tenantId: string): readonly SentimentAuditEntry[] { return auditLog.filter(e => e.tenantId === tenantId); }

const POSITIVE_KEYWORDS = ['감사', '만족', '훌륭', '편리', '개선', '좋은', '우수', '빠른', '친절', '효율'];
const NEGATIVE_KEYWORDS = ['불만', '불편', '느린', '오류', '실망', '부족', '지연', '장애', '거부', '복잡'];

export function analyzeSentiment(input: SentimentInput): SentimentResult {
  const text = input.text.toLowerCase();
  const posMatches = POSITIVE_KEYWORDS.filter(k => text.includes(k));
  const negMatches = NEGATIVE_KEYWORDS.filter(k => text.includes(k));
  const posScore = posMatches.length;
  const negScore = negMatches.length;
  const total = posScore + negScore;
  let sentiment: SentimentResult['sentiment'] = 'neutral';
  let score = 0.5;
  if (posScore > negScore) { sentiment = 'positive'; score = total > 0 ? 0.5 + (posScore / (total * 2)) : 0.6; }
  else if (negScore > posScore) { sentiment = 'negative'; score = total > 0 ? 0.5 - (negScore / (total * 2)) : 0.4; }
  const confidence = total > 0 ? Math.min(1, total * 0.15 + 0.3) : 0.3;
  return { textId: input.textId, sentiment, score, confidence, keywords: [...posMatches, ...negMatches] };
}

export function analyzeBatch(tenantId: string, inputs: SentimentInput[]): SentimentResult[] {
  const results = inputs.map(i => analyzeSentiment(i));
  recordAudit({ actor: 'system', tenantId, action: 'SENTIMENT_BATCH_ANALYZED', target: tenantId, details: { count: inputs.length, positive: results.filter(r => r.sentiment === 'positive').length, negative: results.filter(r => r.sentiment === 'negative').length } });
  return results;
}

export function calculateTrend(results: SentimentResult[], period: string): SentimentTrend {
  const pos = results.filter(r => r.sentiment === 'positive').length;
  const neg = results.filter(r => r.sentiment === 'negative').length;
  const neu = results.filter(r => r.sentiment === 'neutral').length;
  const avg = results.length > 0 ? results.reduce((s, r) => s + r.score, 0) / results.length : 0.5;
  return { period, positive: pos, negative: neg, neutral: neu, averageScore: avg };
}

export class SentimentAnalysisService {
  constructor(private readonly tenantId: string) {}
  analyze(input: SentimentInput): SentimentResult { return analyzeSentiment(input); }
  analyzeBatch(inputs: SentimentInput[]): SentimentResult[] { return analyzeBatch(this.tenantId, inputs); }
  trend(results: SentimentResult[], period: string): SentimentTrend { return calculateTrend(results, period); }
  getAuditLog(): readonly SentimentAuditEntry[] { return getSentimentAuditLog(this.tenantId); }
}
