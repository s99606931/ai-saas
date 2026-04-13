// Design Ref: §핵심 알고리즘 — Jaccard 유사도 협업 필터링 + 인기도 폴백
// Plan SC: FR-R265.1~5

import { createHash } from 'crypto';

enum DataGrade { C = 'C', S = 'S', O = 'O' }

interface PublicService {
  id: string;
  name: string;
  category: string;
  tags: string[];
}

interface Recommendation {
  serviceId: string;
  serviceName: string;
  score: number;
  reason: 'collaborative' | 'popular';
}

interface AuditEntry {
  timestamp: string;
  action: string;
  details: Record<string, unknown>;
}

// Plan SC: FR-R265.5 — userId PII 마스킹
function maskUserId(userId: string): string {
  return createHash('sha256').update(userId).digest('hex').slice(0, 16);
}

// Plan SC: FR-R265.5
function guardDataGrade(grade: DataGrade): void {
  if (grade === DataGrade.C || grade === DataGrade.S) {
    throw new Error(`BLOCKED: ${grade}등급 데이터는 AI API 전송 금지 (N2SF N-05)`);
  }
}

export class PublicServiceRecommenderV2 {
  private services = new Map<string, PublicService>();
  private usageMap = new Map<string, Set<string>>(); // maskedUserId → serviceIds
  private serviceUsageCount = new Map<string, number>();
  private auditLog: AuditEntry[] = [];

  private log(action: string, details: Record<string, unknown>): void {
    this.auditLog.push({ timestamp: new Date().toISOString(), action, details });
  }

  // Plan SC: FR-R265.1
  registerService(id: string, name: string, category: string, tags: string[]): void {
    this.services.set(id, { id, name, category, tags });
    this.log('REGISTER_SERVICE', { id, name, category });
  }

  // Plan SC: FR-R265.2
  recordUsage(userId: string, serviceId: string, grade: DataGrade = DataGrade.O): void {
    guardDataGrade(grade);
    if (!this.services.has(serviceId)) throw new Error(`서비스 미등록: ${serviceId}`);

    const maskedId = maskUserId(userId);
    if (!this.usageMap.has(maskedId)) {
      this.usageMap.set(maskedId, new Set());
    }
    this.usageMap.get(maskedId)!.add(serviceId);
    this.serviceUsageCount.set(serviceId, (this.serviceUsageCount.get(serviceId) ?? 0) + 1);
    this.log('RECORD_USAGE', { maskedUserId: maskedId, serviceId });
  }

  // Plan SC: FR-R265.3
  recommend(userId: string, topN: number = 5): Recommendation[] {
    const maskedId = maskUserId(userId);
    const userServices = this.usageMap.get(maskedId);

    if (!userServices || userServices.size === 0) {
      return this.getPopularServices(topN).map(s => ({ serviceId: s.id, serviceName: s.name, score: this.serviceUsageCount.get(s.id) ?? 0, reason: 'popular' as const }));
    }

    // 유사 사용자 탐색 (Jaccard 유사도)
    const candidates = new Map<string, number>();

    for (const [otherId, otherServices] of this.usageMap.entries()) {
      if (otherId === maskedId) continue;
      const intersection = [...userServices].filter(s => otherServices.has(s)).length;
      const union = new Set([...userServices, ...otherServices]).size;
      const similarity = union === 0 ? 0 : intersection / union;
      if (similarity > 0) {
        for (const serviceId of otherServices) {
          if (!userServices.has(serviceId)) {
            candidates.set(serviceId, (candidates.get(serviceId) ?? 0) + similarity);
          }
        }
      }
    }

    const results: Recommendation[] = Array.from(candidates.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, topN)
      .map(([serviceId, score]) => {
        const svc = this.services.get(serviceId)!;
        return { serviceId, serviceName: svc.name, score: Math.round(score * 100) / 100, reason: 'collaborative' as const };
      });

    if (results.length < topN) {
      const popular = this.getPopularServices(topN - results.length)
        .filter(s => !userServices.has(s.id) && !results.find(r => r.serviceId === s.id))
        .map(s => ({ serviceId: s.id, serviceName: s.name, score: this.serviceUsageCount.get(s.id) ?? 0, reason: 'popular' as const }));
      results.push(...popular);
    }

    this.log('RECOMMEND', { maskedUserId: maskedId, count: results.length });
    return results.slice(0, topN);
  }

  // Plan SC: FR-R265.4
  getPopularServices(topN: number = 5): PublicService[] {
    return Array.from(this.services.values())
      .sort((a, b) => (this.serviceUsageCount.get(b.id) ?? 0) - (this.serviceUsageCount.get(a.id) ?? 0))
      .slice(0, topN);
  }

  // Plan SC: FR-R265.5
  getAuditLog(): AuditEntry[] {
    return [...this.auditLog];
  }
}
