// Design Ref: SVC-AI-ADV-R682.design.md — AI기반 위협 인텔리전스 집계 v2
// Plan SC: FR-R682.1~5

import { createHash } from 'crypto';

export type ThreatGrade = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';

export interface ThreatFeed {
  feedId: string;
  name: string;
  reliability: number;
}

export interface ThreatIndicator {
  iocId: string;
  feedId: string;
  severity: number;
  analystEmail: string;
}

export interface AggregatedIndicator {
  iocId: string;
  score: number;
  grade: ThreatGrade;
  maskedAnalyst: string;
}

interface AuditEntry {
  timestamp: string;
  action: string;
  details?: Record<string, unknown>;
}

function maskPII(value: string): string {
  return createHash('sha256').update(value).digest('hex').substring(0, 16);
}

export class AiThreatIntelAggregatorV2 {
  private readonly feeds = new Map<string, ThreatFeed>();
  private readonly indicators = new Map<string, AggregatedIndicator>();
  private readonly auditLog: AuditEntry[] = [];

  registerFeed(feed: ThreatFeed): void {
    if (feed.reliability < 0 || feed.reliability > 1) {
      throw new Error('INVALID_RELIABILITY');
    }
    this.feeds.set(feed.feedId, feed);
    this.auditLog.push({
      timestamp: new Date().toISOString(),
      action: 'REGISTER_FEED',
      details: { feedId: feed.feedId, name: feed.name, reliability: feed.reliability },
    });
  }

  ingest(indicator: ThreatIndicator, dataGrade?: string): AggregatedIndicator {
    if (dataGrade === 'C' || dataGrade === 'S') {
      throw new Error(`BLOCKED: ${dataGrade}등급 AI API 전송 금지 (N2SF N-05)`);
    }
    const feed = this.feeds.get(indicator.feedId);
    if (!feed) {
      throw new Error(`UNKNOWN_FEED: ${indicator.feedId}`);
    }
    if (indicator.severity < 0 || indicator.severity > 1) {
      throw new Error('INVALID_SEVERITY');
    }

    const newScore = indicator.severity * feed.reliability;
    const existing = this.indicators.get(indicator.iocId);
    const score = existing ? Math.max(existing.score, newScore) : newScore;

    let grade: ThreatGrade;
    if (score >= 0.8) grade = 'CRITICAL';
    else if (score >= 0.5) grade = 'HIGH';
    else if (score >= 0.3) grade = 'MEDIUM';
    else grade = 'LOW';

    const maskedAnalyst = maskPII(indicator.analystEmail);
    const agg: AggregatedIndicator = {
      iocId: indicator.iocId,
      score: Number(score.toFixed(4)),
      grade,
      maskedAnalyst,
    };
    this.indicators.set(indicator.iocId, agg);

    this.auditLog.push({
      timestamp: new Date().toISOString(),
      action: 'INGEST',
      details: { iocId: indicator.iocId, feedId: indicator.feedId, grade, maskedAnalyst },
    });
    return agg;
  }

  getIndicators(): AggregatedIndicator[] {
    return Array.from(this.indicators.values());
  }

  getAuditLog(): AuditEntry[] {
    return [...this.auditLog];
  }
}
