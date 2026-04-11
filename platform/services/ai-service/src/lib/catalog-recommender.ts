// AI 서비스 카탈로그 추천 -- FR-N276.1~FR-N276.6
// Design Ref: MTU-N276 DESIGN §1~§6
// CSAP: D-06 감사, D-08 접근 통제, D-12 개발 보안

import { randomUUID } from 'crypto';

// -- 타입 정의 ────────────────────────────────────────────────────────────────

export interface CatalogService {
  id: string;
  name: string;
  description: string;
  category: string;
  tags: string[];
  features: string[];
  targetOrganizationType: string[];
  monthlyPrice: number;
}

export interface UserProfile {
  userId: string;
  organizationId: string;
  organizationType: string;
  adoptedServices: string[];
  searchHistory: string[];
  clickHistory: string[];
}

export interface Recommendation {
  serviceId: string;
  serviceName: string;
  score: number;
  reason: string;
  method: 'collaborative' | 'content_based' | 'hybrid';
}

export interface RecommendationResult {
  id: string;
  userId: string;
  recommendations: Recommendation[];
  createdAt: string;
}

export interface RecommendationMetrics {
  totalRecommendations: number;
  clickRate: number;
  adoptionRate: number;
  period: string;
}

// -- 저장소 ──────────────────────────────────────────────────────────────────

const catalog = new Map<string, CatalogService>();
const profiles = new Map<string, UserProfile>();
const auditLog: { id: string; action: string; actor: string; timestamp: string }[] = [];

function recordAudit(action: string, actor: string): void {
  auditLog.push({ id: randomUUID(), action, actor, timestamp: new Date().toISOString() });
}

export function getCatalogAuditLog() { return [...auditLog]; }

// -- §1 카탈로그 인덱싱 ──────────────────────────────────────────────────────

export function indexService(service: CatalogService): void {
  catalog.set(service.id, service);
}

export function getService(id: string): CatalogService | undefined {
  return catalog.get(id);
}

// -- §2~§4 추천 엔진 ────────────────────────────────────────────────────────

/** 코사인 유사도 (태그 기반) */
function tagSimilarity(a: string[], b: string[]): number {
  const setA = new Set(a);
  const setB = new Set(b);
  const intersection = [...setA].filter((x) => setB.has(x)).length;
  const union = new Set([...setA, ...setB]).size;
  return union > 0 ? intersection / union : 0;
}

/** 콘텐츠 기반 추천 -- FR-N276.4 */
export function contentBasedRecommend(profile: UserProfile, limit: number = 5): Recommendation[] {
  const adopted = profile.adoptedServices
    .map((id) => catalog.get(id))
    .filter(Boolean) as CatalogService[];

  const adoptedTags = adopted.flatMap((s) => s.tags);
  const adoptedIds = new Set(profile.adoptedServices);

  const candidates: Recommendation[] = [];
  for (const [, service] of catalog) {
    if (adoptedIds.has(service.id)) continue;
    const similarity = tagSimilarity(adoptedTags, service.tags);
    if (similarity > 0) {
      candidates.push({
        serviceId: service.id,
        serviceName: service.name,
        score: similarity,
        reason: `기존 사용 서비스와 태그 유사도 ${(similarity * 100).toFixed(0)}%`,
        method: 'content_based',
      });
    }
  }

  return candidates.sort((a, b) => b.score - a.score).slice(0, limit);
}

/** 협업 필터링 추천 -- FR-N276.3 */
export function collaborativeRecommend(profile: UserProfile, allProfiles: UserProfile[], limit: number = 5): Recommendation[] {
  const similarOrgs = allProfiles.filter(
    (p) => p.organizationType === profile.organizationType && p.userId !== profile.userId
  );

  const serviceScores = new Map<string, number>();
  const adoptedIds = new Set(profile.adoptedServices);

  for (const org of similarOrgs) {
    for (const serviceId of org.adoptedServices) {
      if (!adoptedIds.has(serviceId)) {
        serviceScores.set(serviceId, (serviceScores.get(serviceId) || 0) + 1);
      }
    }
  }

  const candidates: Recommendation[] = [];
  for (const [serviceId, count] of serviceScores) {
    const service = catalog.get(serviceId);
    if (service) {
      candidates.push({
        serviceId,
        serviceName: service.name,
        score: count / Math.max(1, similarOrgs.length),
        reason: `유사 기관 ${count}곳에서 사용 중`,
        method: 'collaborative',
      });
    }
  }

  return candidates.sort((a, b) => b.score - a.score).slice(0, limit);
}

/** 하이브리드 추천 -- FR-N276.2 */
export function recommend(
  userId: string,
  allProfiles: UserProfile[],
  actor: string,
  limit: number = 10
): RecommendationResult {
  const profile = profiles.get(userId) || allProfiles.find((p) => p.userId === userId);
  if (!profile) {
    return { id: randomUUID(), userId, recommendations: [], createdAt: new Date().toISOString() };
  }

  const contentRecs = contentBasedRecommend(profile, limit);
  const collabRecs = collaborativeRecommend(profile, allProfiles, limit);

  // 하이브리드 병합 (가중 평균)
  const merged = new Map<string, Recommendation>();
  for (const rec of contentRecs) {
    merged.set(rec.serviceId, { ...rec, score: rec.score * 0.4, method: 'hybrid' });
  }
  for (const rec of collabRecs) {
    const existing = merged.get(rec.serviceId);
    if (existing) {
      existing.score += rec.score * 0.6;
      existing.reason = `${existing.reason} + ${rec.reason}`;
    } else {
      merged.set(rec.serviceId, { ...rec, score: rec.score * 0.6, method: 'hybrid' });
    }
  }

  const recommendations = Array.from(merged.values())
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);

  recordAudit('RECOMMENDATION_GENERATED', actor);
  return { id: randomUUID(), userId, recommendations, createdAt: new Date().toISOString() };
}

/** 사용자 프로파일 등록 */
export function registerProfile(profile: UserProfile): void {
  profiles.set(profile.userId, profile);
}
