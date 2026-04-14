// Design Ref: SVC-AI-ADV-R672.design.md — AI기반 지능형 캐시 관리 v3
// Plan SC: FR-R672.1~5

import { createHash } from 'crypto';

export type CacheTier = 'HOT' | 'WARM' | 'COLD';

interface AccessStat {
  hits: number;
  lastAccessAt: Date;
}
interface CacheRecommendation {
  maskedKey: string;
  tier: CacheTier;
  ttlSec: number;
  score: number;
}
interface AuditEntry { timestamp: string; action: string; details?: Record<string, unknown> }

const TTL_BY_TIER: Record<CacheTier, number> = {
  HOT: 3600,
  WARM: 600,
  COLD: 60,
};

function mask(v: string): string {
  return createHash('sha256').update(v).digest('hex').substring(0, 16);
}

export class IntelligentCacheManagerV3 {
  private auditLog: AuditEntry[] = [];
  private stats: Map<string, AccessStat> = new Map();

  record(key: string, hits: number, lastAccessAt: Date): void {
    const cur = this.stats.get(key);
    if (cur) {
      cur.hits += hits;
      if (lastAccessAt > cur.lastAccessAt) cur.lastAccessAt = lastAccessAt;
    } else {
      this.stats.set(key, { hits, lastAccessAt });
    }
    this.auditLog.push({
      timestamp: new Date().toISOString(),
      action: 'RECORD_ACCESS',
      details: { masked: mask(key), hits },
    });
  }

  recommend(now: Date = new Date(), dataGrade?: string): CacheRecommendation[] {
    if (dataGrade === 'C' || dataGrade === 'S') {
      throw new Error(`BLOCKED: ${dataGrade}등급 AI API 전송 금지 (N2SF N-05)`);
    }
    const results: CacheRecommendation[] = [];
    for (const [key, stat] of this.stats.entries()) {
      const ageMin = Math.max(0, (now.getTime() - stat.lastAccessAt.getTime()) / 60000);
      const decay = 1 / (1 + ageMin / 60);
      const score = stat.hits * decay;
      let tier: CacheTier;
      if (score >= 100) tier = 'HOT';
      else if (score >= 10) tier = 'WARM';
      else tier = 'COLD';
      results.push({
        maskedKey: mask(key),
        tier,
        ttlSec: TTL_BY_TIER[tier],
        score: Number(score.toFixed(4)),
      });
    }
    this.auditLog.push({
      timestamp: new Date().toISOString(),
      action: 'RECOMMEND',
      details: { count: results.length },
    });
    return results;
  }

  getAuditLog(): AuditEntry[] {
    return [...this.auditLog];
  }
}
