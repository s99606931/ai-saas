// SVC-AI-ADV-R474 AI Citizen Sentiment Analyzer
// Design Ref: SVC-AI-ADV-R474.design.md §시민감정
// Plan SC: FR-474.1~6
// CSAP D-06 / N2SF N-05

export type DataGrade = 'O' | 'C' | 'S';

export interface SentimentResult {
  readonly text: string;
  readonly polarity: number; // -1..1
  readonly label: 'POSITIVE' | 'NEUTRAL' | 'NEGATIVE';
  readonly keywords: readonly string[];
}

export interface AggregateResult {
  readonly total: number;
  readonly positive: number;
  readonly neutral: number;
  readonly negative: number;
  readonly meanPolarity: number;
  readonly topKeywords: readonly { word: string; count: number }[];
}

interface AuditEntry {
  readonly timestamp: string;
  readonly action: string;
  readonly details: Record<string, unknown>;
}

const POS_WORDS: readonly string[] = [
  '좋',
  '만족',
  '감사',
  '훌륭',
  '편리',
  '친절',
  '신속',
];
const NEG_WORDS: readonly string[] = [
  '불만',
  '느림',
  '불편',
  '나쁨',
  '지연',
  '실망',
  '부당',
];

function block(grade: DataGrade): void {
  if (grade === 'C' || grade === 'S') {
    throw new Error(`N2SF_BLOCKED: ${grade}등급 시민 데이터 차단 (N2SF N-05)`);
  }
}

function countMatches(text: string, words: readonly string[]): number {
  let n = 0;
  for (const w of words) {
    if (text.includes(w)) n += 1;
  }
  return n;
}

export class AiCitizenSentimentAnalyzer {
  private readonly auditLog: AuditEntry[] = [];

  analyze(text: string, grade: DataGrade = 'O'): SentimentResult {
    block(grade);

    const lower = text;
    const pos = countMatches(lower, POS_WORDS);
    const neg = countMatches(lower, NEG_WORDS);
    const total = pos + neg;
    const polarity = total === 0 ? 0 : (pos - neg) / total;
    const label: 'POSITIVE' | 'NEUTRAL' | 'NEGATIVE' =
      polarity > 0.2 ? 'POSITIVE' : polarity < -0.2 ? 'NEGATIVE' : 'NEUTRAL';
    const keywords: string[] = [];
    for (const w of POS_WORDS) if (lower.includes(w)) keywords.push(w);
    for (const w of NEG_WORDS) if (lower.includes(w)) keywords.push(w);

    this.appendAudit('SENTIMENT_ANALYZE', { label, polarity });

    return {
      text,
      polarity: Number(polarity.toFixed(3)),
      label,
      keywords,
    };
  }

  aggregate(texts: readonly string[]): AggregateResult {
    const results = texts.map((t) => this.analyze(t));
    let pos = 0;
    let neu = 0;
    let neg = 0;
    let sum = 0;
    const freq = new Map<string, number>();

    for (const r of results) {
      if (r.label === 'POSITIVE') pos += 1;
      else if (r.label === 'NEUTRAL') neu += 1;
      else neg += 1;
      sum += r.polarity;
      for (const k of r.keywords) {
        freq.set(k, (freq.get(k) ?? 0) + 1);
      }
    }

    const top = [...freq.entries()]
      .map(([word, count]) => ({ word, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    const mean = results.length === 0 ? 0 : sum / results.length;
    this.appendAudit('SENTIMENT_AGGREGATE', {
      total: results.length,
      meanPolarity: mean,
    });

    return {
      total: results.length,
      positive: pos,
      neutral: neu,
      negative: neg,
      meanPolarity: Number(mean.toFixed(3)),
      topKeywords: top,
    };
  }

  getAuditLog(): readonly AuditEntry[] {
    return [...this.auditLog];
  }

  private appendAudit(action: string, details: Record<string, unknown>): void {
    this.auditLog.push({
      timestamp: new Date().toISOString(),
      action,
      details,
    });
  }
}
