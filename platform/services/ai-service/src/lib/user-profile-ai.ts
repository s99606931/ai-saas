// AI 사용자 프로파일 관리 -- FR-ADV33.2, FR-ADV33.4, FR-ADV33.5
// Design Ref: SVC-AI-ADV-R33 DESIGN §2, §4, §5
// Plan SC: SC-2 (테넌트 격리 100%), SC-5 (PII 마스킹)
// CSAP: D-08 프로파일 접근 통제, N2SF PII 마스킹

import { createHash } from 'crypto';

// -- 타입 정의 ────────────────────────────────────────────────────────────────

/** 행동 이벤트 유형 -- Design §1 */
export type UserEventType = 'view' | 'click' | 'search' | 'download' | 'bookmark' | 'share';

/** 행동 이벤트 */
export interface UserEvent {
  userId: string;
  tenantId: string;
  contentId: string;
  eventType: UserEventType;
  timestamp: string;
  context?: Record<string, unknown>;
  category?: string;
}

/** 사용자 관심도 -- Design §2 */
export interface InterestScore {
  category: string;
  score: number;
  lastUpdated: string;
}

/** 사용자 프로파일 -- Design §2 */
export interface UserProfile {
  /** 사용자 ID (해시된 값, PII 아님) */
  userIdHash: string;
  tenantId: string;
  /** 카테고리별 관심도 */
  interests: InterestScore[];
  /** 최근 상호작용 콘텐츠 ID */
  recentItems: { contentId: string; eventType: UserEventType; timestamp: string }[];
  /** 사용자 선호 설정 */
  preferences: UserPreferences;
  /** 사용자 관심사 임베딩 벡터 */
  embedding?: number[];
  /** 총 이벤트 수 */
  totalEvents: number;
  createdAt: string;
  updatedAt: string;
}

/** 사용자 선호 설정 */
export interface UserPreferences {
  preferredTimeSlot?: 'morning' | 'afternoon' | 'evening';
  preferredContentFormat?: 'document' | 'video' | 'summary';
  language?: string;
}

/** 프로파일 매니저 설정 */
export interface UserProfileConfig {
  /** 최근 항목 최대 보관 수 */
  maxRecentItems: number;
  /** 관심도 감쇠 계수 (오래될수록 감소) */
  decayFactor: number;
  /** 임베딩 프로바이더 */
  embeddingProvider?: (text: string) => Promise<number[]>;
}

// -- 기본 설정 ────────────────────────────────────────────────────────────────

const DEFAULT_CONFIG: UserProfileConfig = {
  maxRecentItems: 100,
  decayFactor: 0.95,
};

// -- 이벤트 가중치 ───────────────────────────────────────────────────────────

const EVENT_WEIGHTS: Record<UserEventType, number> = {
  view: 1.0,
  click: 1.5,
  search: 2.0,
  download: 3.0,
  bookmark: 4.0,
  share: 5.0,
};

// -- PII 마스킹 (N2SF 필수) -- Design §5 ─────────────────────────────────────

/** 사용자 ID를 SHA-256 해시로 변환 */
export function hashUserId(userId: string): string {
  return createHash('sha256').update(userId).digest('hex').slice(0, 32);
}

// -- 감사 로그 ────────────────────────────────────────────────────────────────

function auditLog(action: string, details: Record<string, unknown>): void {
  const entry = {
    timestamp: new Date().toISOString(),
    component: 'user-profile-ai',
    action,
    ...details,
  };
  console.log(`[AUDIT] ${JSON.stringify(entry)}`);
}

// -- UserProfileManager 메인 클래스 ──────────────────────────────────────────

/** AI 사용자 프로파일 매니저 -- Design §2 */
export class UserProfileManager {
  private readonly config: UserProfileConfig;
  private profiles: Map<string, UserProfile> = new Map();

  constructor(config?: Partial<UserProfileConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  // -- 프로파일 키 생성 (테넌트 격리) -- Design §4 ────────────────────────

  private profileKey(tenantId: string, userId: string): string {
    return `tenant:${tenantId}:profile:${hashUserId(userId)}`;
  }

  // -- 프로파일 CRUD ─────────────────────────────────────────────────────

  /** 프로파일 조회 (없으면 생성) */
  getOrCreateProfile(tenantId: string, userId: string): UserProfile {
    const key = this.profileKey(tenantId, userId);
    let profile = this.profiles.get(key);

    if (!profile) {
      profile = {
        userIdHash: hashUserId(userId),
        tenantId,
        interests: [],
        recentItems: [],
        preferences: {},
        totalEvents: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      this.profiles.set(key, profile);
    }

    return profile;
  }

  /** 프로파일 조회 */
  getProfile(tenantId: string, userId: string): UserProfile | undefined {
    return this.profiles.get(this.profileKey(tenantId, userId));
  }

  /** 프로파일 삭제 */
  deleteProfile(tenantId: string, userId: string): boolean {
    const key = this.profileKey(tenantId, userId);
    const deleted = this.profiles.delete(key);
    if (deleted) {
      auditLog('profile_deleted', { tenantId, userIdHash: hashUserId(userId) });
    }
    return deleted;
  }

  // -- 이벤트 처리 ───────────────────────────────────────────────────────

  /** 행동 이벤트 처리 -- Design §1, §2 */
  processEvent(event: UserEvent): UserProfile {
    const profile = this.getOrCreateProfile(event.tenantId, event.userId);

    // 최근 항목 추가
    profile.recentItems.unshift({
      contentId: event.contentId,
      eventType: event.eventType,
      timestamp: event.timestamp,
    });

    // 최대 보관 수 제한
    if (profile.recentItems.length > this.config.maxRecentItems) {
      profile.recentItems = profile.recentItems.slice(0, this.config.maxRecentItems);
    }

    // 관심도 갱신
    if (event.category) {
      this.updateInterest(profile, event.category, event.eventType);
    }

    // 시간대 선호 갱신
    this.updateTimePreference(profile, event.timestamp);

    profile.totalEvents += 1;
    profile.updatedAt = new Date().toISOString();

    return profile;
  }

  /** 배치 이벤트 처리 */
  processEvents(events: UserEvent[]): void {
    for (const event of events) {
      this.processEvent(event);
    }
    auditLog('batch_events_processed', { count: events.length });
  }

  // -- 관심도 갱신 ───────────────────────────────────────────────────────

  /** 카테고리 관심도 갱신 -- Design §2 */
  private updateInterest(
    profile: UserProfile,
    category: string,
    eventType: UserEventType,
  ): void {
    const weight = EVENT_WEIGHTS[eventType];
    const existing = profile.interests.find((i) => i.category === category);

    if (existing) {
      // 기존 점수에 가중치 추가 (감쇠 적용)
      existing.score = Math.min(
        1.0,
        existing.score * this.config.decayFactor + weight * 0.1,
      );
      existing.lastUpdated = new Date().toISOString();
    } else {
      profile.interests.push({
        category,
        score: Math.min(1.0, weight * 0.1),
        lastUpdated: new Date().toISOString(),
      });
    }

    // 관심도 순 정렬
    profile.interests.sort((a, b) => b.score - a.score);
  }

  /** 시간대 선호 갱신 */
  private updateTimePreference(profile: UserProfile, timestamp: string): void {
    const hour = new Date(timestamp).getHours();
    if (hour >= 6 && hour < 12) {
      profile.preferences.preferredTimeSlot = 'morning';
    } else if (hour >= 12 && hour < 18) {
      profile.preferences.preferredTimeSlot = 'afternoon';
    } else {
      profile.preferences.preferredTimeSlot = 'evening';
    }
  }

  // -- 임베딩 갱신 ───────────────────────────────────────────────────────

  /** 사용자 관심사 임베딩 갱신 -- Design §2 */
  async updateEmbedding(tenantId: string, userId: string): Promise<void> {
    if (!this.config.embeddingProvider) return;

    const profile = this.getProfile(tenantId, userId);
    if (!profile) return;

    // 관심사 텍스트 구성
    const interestText = profile.interests
      .slice(0, 10)
      .map((i) => `${i.category}: ${i.score.toFixed(2)}`)
      .join(', ');

    if (!interestText) return;

    profile.embedding = await this.config.embeddingProvider(interestText);
    profile.updatedAt = new Date().toISOString();
  }

  // -- 관심도 감쇠 ───────────────────────────────────────────────────────

  /** 전체 프로파일 관심도 감쇠 적용 (주기적 실행) */
  applyDecay(): void {
    for (const profile of this.profiles.values()) {
      for (const interest of profile.interests) {
        interest.score *= this.config.decayFactor;
      }
      // 극소 점수 제거
      profile.interests = profile.interests.filter((i) => i.score > 0.01);
    }
  }

  // -- 통계 ──────────────────────────────────────────────────────────────

  /** 테넌트별 프로파일 수 */
  getProfileCount(tenantId: string): number {
    let count = 0;
    for (const profile of this.profiles.values()) {
      if (profile.tenantId === tenantId) count++;
    }
    return count;
  }

  /** 전체 프로파일 수 */
  getTotalProfileCount(): number {
    return this.profiles.size;
  }
}

// -- 팩토리 ──────────────────────────────────────────────────────────────────

let managerInstance: UserProfileManager | null = null;

export function getUserProfileManager(
  config?: Partial<UserProfileConfig>,
): UserProfileManager {
  if (!managerInstance) {
    managerInstance = new UserProfileManager(config);
  }
  return managerInstance;
}

export function resetUserProfileManager(): void {
  managerInstance = null;
}
