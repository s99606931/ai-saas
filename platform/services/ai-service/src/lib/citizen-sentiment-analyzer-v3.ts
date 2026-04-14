// Design Ref: SVC-AI-ADV-R606-v3.design.md §알고리즘
// Plan SC: SC-R606v3-1, SC-R606v3-2, SC-R606v3-3
// 트랙 A 22차

import { createHash } from 'crypto';

export interface SentimentInput {
  id: string;
  citizenEmail: string;
  text: string;
  grade: 'C' | 'S' | 'O';
}

export type Sentiment = 'POSITIVE' | 'NEUTRAL' | 'NEGATIVE';

export interface SentimentResult {
  id: string;
  sentiment: Sentiment;
  score: number;
  maskedCitizen: string;
}

export interface AuditEntry {
  timestamp: string;
  action: string;
  actor?: string;
  details?: Record<string, unknown>;
}

const NEGATIVE_WORDS = ['분노', '불만', '항의', '화나', '최악', '최저'];
const POSITIVE_WORDS = ['감사', '만족', '친절', '좋', '최고'];

function maskPII(value: string): string {
  return createHash('sha256').update(value).digest('hex').substring(0, 16);
}

export class CitizenSentimentAnalyzerV3 {
  private readonly auditLog: AuditEntry[] = [];

  analyze(input: SentimentInput): SentimentResult {
    if (input.grade === 'C' || input.grade === 'S') {
      throw new Error('BLOCKED: C/S등급 AI API 전송 금지 (N2SF N-05)');
    }
    const text = input.text;
    let neg = 0;
    let pos = 0;
    for (const w of NEGATIVE_WORDS) {
      if (text.includes(w)) neg++;
    }
    for (const w of POSITIVE_WORDS) {
      if (text.includes(w)) pos++;
    }
    const score = pos - neg;
    let sentiment: Sentiment;
    if (score <= -2) sentiment = 'NEGATIVE';
    else if (score >= 2) sentiment = 'POSITIVE';
    else sentiment = 'NEUTRAL';

    const maskedCitizen = maskPII(input.citizenEmail);

    this.auditLog.push({
      timestamp: new Date().toISOString(),
      action: 'SENTIMENT_ANALYZE',
      actor: maskedCitizen,
      details: { id: input.id, sentiment, score },
    });

    return { id: input.id, sentiment, score, maskedCitizen };
  }

  getAuditLog(): AuditEntry[] {
    return [...this.auditLog];
  }
}
