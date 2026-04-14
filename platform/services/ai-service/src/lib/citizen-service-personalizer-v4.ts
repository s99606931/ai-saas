// Design Ref: SVC-AI-ADV-R704.design.md — AI기반 민원인 서비스 개인화 v4
// Plan SC: FR-R704.1~5

import { createHash } from 'crypto';

export type FeedbackType = 'LIKE' | 'DISLIKE';

interface ServiceSpec { serviceId: string; tags: string[] }
interface ProfileInput {
  citizenId: string;
  interestTags: string[];
}
interface Recommendation { serviceId: string; score: number }
interface Profile {
  interests: Set<string>;
  dislikes: Set<string>;
  likes: Map<string, number>;
}
interface AuditEntry { timestamp: string; action: string; details?: Record<string, unknown> }

function maskId(value: string): string {
  return createHash('sha256').update(value).digest('hex').substring(0, 16);
}

export class CitizenServicePersonalizerV4 {
  private catalog = new Map<string, Set<string>>();
  private profiles = new Map<string, Profile>();
  private auditLog: AuditEntry[] = [];

  registerService(spec: ServiceSpec): void {
    if (!spec.serviceId) throw new Error('INVALID_SERVICE_ID');
    this.catalog.set(spec.serviceId, new Set(spec.tags));
    this.auditLog.push({
      timestamp: new Date().toISOString(),
      action: 'REGISTER_SERVICE',
      details: { serviceId: spec.serviceId, tagCount: spec.tags.length },
    });
  }

  upsertProfile(input: ProfileInput, dataGrade?: string): string {
    if (dataGrade === 'C' || dataGrade === 'S') {
      throw new Error(`BLOCKED: ${dataGrade}등급 AI API 전송 금지 (N2SF N-05)`);
    }
    const masked = maskId(input.citizenId);
    const existing = this.profiles.get(masked);
    const profile: Profile = existing ?? { interests: new Set(), dislikes: new Set(), likes: new Map() };
    profile.interests = new Set(input.interestTags);
    this.profiles.set(masked, profile);
    this.auditLog.push({
      timestamp: new Date().toISOString(),
      action: 'UPSERT_PROFILE',
      details: { maskedCitizenId: masked, interestCount: input.interestTags.length },
    });
    return masked;
  }

  recordFeedback(citizenId: string, serviceId: string, feedback: FeedbackType): void {
    const masked = maskId(citizenId);
    const profile = this.profiles.get(masked);
    if (!profile) throw new Error('UNKNOWN_PROFILE');
    if (!this.catalog.has(serviceId)) throw new Error(`UNKNOWN_SERVICE: ${serviceId}`);
    if (feedback === 'LIKE') {
      profile.dislikes.delete(serviceId);
      profile.likes.set(serviceId, (profile.likes.get(serviceId) ?? 0) + 1);
    } else {
      profile.dislikes.add(serviceId);
      profile.likes.delete(serviceId);
    }
    this.auditLog.push({
      timestamp: new Date().toISOString(),
      action: 'FEEDBACK',
      details: { maskedCitizenId: masked, serviceId, feedback },
    });
  }

  recommend(citizenId: string, topN: number): Recommendation[] {
    const masked = maskId(citizenId);
    const profile = this.profiles.get(masked);
    if (!profile) throw new Error('UNKNOWN_PROFILE');
    const recs: Recommendation[] = [];
    for (const [sid, tags] of this.catalog.entries()) {
      if (profile.dislikes.has(sid)) continue;
      let score = 0;
      for (const t of tags) if (profile.interests.has(t)) score += 1;
      score += profile.likes.get(sid) ?? 0;
      if (score > 0) recs.push({ serviceId: sid, score });
    }
    recs.sort((a, b) => b.score - a.score);
    this.auditLog.push({
      timestamp: new Date().toISOString(),
      action: 'RECOMMEND',
      details: { maskedCitizenId: masked, count: Math.min(topN, recs.length) },
    });
    return recs.slice(0, topN);
  }

  getAuditLog(): AuditEntry[] {
    return [...this.auditLog];
  }
}
