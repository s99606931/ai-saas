// SVC-AI-ADV-R33 단위 테스트: AI 사용자 프로파일 관리
// Design Ref: SVC-AI-ADV-R33 DESIGN §2, §4, §5
// Plan SC: FR-ADV33.2, FR-ADV33.4, FR-ADV33.5
// CSAP: D-08 프로파일 접근 통제
// N2SF: N-05 PII 마스킹 (userId 해시)

import { describe, it, expect, beforeEach, afterEach } from 'vitest';

import {
  UserProfileManager,
  getUserProfileManager,
  resetUserProfileManager,
  hashUserId,
} from '../../src/lib/user-profile-ai.js';
import type { UserEvent } from '../../src/lib/user-profile-ai.js';

// -- PII 마스킹 -- Design §5 -------------------------------------------------

describe('hashUserId PII 마스킹 (FR-ADV33.5)', () => {
  it('동일 ID는 동일 해시', () => {
    expect(hashUserId('user-001')).toBe(hashUserId('user-001'));
  });

  it('다른 ID는 다른 해시', () => {
    expect(hashUserId('user-001')).not.toBe(hashUserId('user-002'));
  });

  it('32자 해시를 반환한다', () => {
    expect(hashUserId('test').length).toBe(32);
  });

  it('원본 ID를 포함하지 않는다', () => {
    const hash = hashUserId('admin@example.com');
    expect(hash).not.toContain('admin');
    expect(hash).not.toContain('@');
  });
});

// -- 프로파일 CRUD -- Design §2 ------------------------------------------------

describe('UserProfileManager 프로파일 관리 (FR-ADV33.2)', () => {
  let manager: UserProfileManager;

  beforeEach(() => {
    manager = new UserProfileManager();
  });

  it('새 프로파일을 생성한다', () => {
    const profile = manager.getOrCreateProfile('tenant-1', 'user-1');
    expect(profile).toBeDefined();
    expect(profile.tenantId).toBe('tenant-1');
    expect(profile.userIdHash).toBe(hashUserId('user-1'));
    expect(profile.interests).toHaveLength(0);
    expect(profile.recentItems).toHaveLength(0);
    expect(profile.totalEvents).toBe(0);
  });

  it('기존 프로파일을 반환한다', () => {
    const p1 = manager.getOrCreateProfile('tenant-1', 'user-1');
    const p2 = manager.getOrCreateProfile('tenant-1', 'user-1');
    expect(p1).toBe(p2);
  });

  it('프로파일을 조회한다', () => {
    manager.getOrCreateProfile('tenant-1', 'user-1');
    const profile = manager.getProfile('tenant-1', 'user-1');
    expect(profile).toBeDefined();
  });

  it('존재하지 않는 프로파일은 undefined', () => {
    expect(manager.getProfile('tenant-1', 'nonexistent')).toBeUndefined();
  });

  it('프로파일을 삭제한다', () => {
    manager.getOrCreateProfile('tenant-1', 'user-1');
    expect(manager.deleteProfile('tenant-1', 'user-1')).toBe(true);
    expect(manager.getProfile('tenant-1', 'user-1')).toBeUndefined();
  });

  it('존재하지 않는 프로파일 삭제는 false', () => {
    expect(manager.deleteProfile('tenant-1', 'nonexistent')).toBe(false);
  });
});

// -- 테넌트 격리 -- Design §4 --------------------------------------------------

describe('UserProfileManager 테넌트 격리 (FR-ADV33.4)', () => {
  let manager: UserProfileManager;

  beforeEach(() => {
    manager = new UserProfileManager();
  });

  it('같은 userId도 다른 테넌트면 다른 프로파일', () => {
    const p1 = manager.getOrCreateProfile('tenant-A', 'user-1');
    const p2 = manager.getOrCreateProfile('tenant-B', 'user-1');
    expect(p1).not.toBe(p2);
    expect(p1.tenantId).toBe('tenant-A');
    expect(p2.tenantId).toBe('tenant-B');
  });

  it('테넌트별 프로파일 수를 카운트한다', () => {
    manager.getOrCreateProfile('tenant-A', 'user-1');
    manager.getOrCreateProfile('tenant-A', 'user-2');
    manager.getOrCreateProfile('tenant-B', 'user-3');
    expect(manager.getProfileCount('tenant-A')).toBe(2);
    expect(manager.getProfileCount('tenant-B')).toBe(1);
  });

  it('전체 프로파일 수를 카운트한다', () => {
    manager.getOrCreateProfile('tenant-A', 'user-1');
    manager.getOrCreateProfile('tenant-B', 'user-2');
    expect(manager.getTotalProfileCount()).toBe(2);
  });
});

// -- 이벤트 처리 -- Design §1, §2 -----------------------------------------------

describe('UserProfileManager 이벤트 처리', () => {
  let manager: UserProfileManager;

  beforeEach(() => {
    manager = new UserProfileManager({ maxRecentItems: 5 });
  });

  it('이벤트를 처리하면 recentItems에 추가된다', () => {
    const event: UserEvent = {
      userId: 'user-1',
      tenantId: 'tenant-1',
      contentId: 'content-1',
      eventType: 'view',
      timestamp: new Date().toISOString(),
    };
    const profile = manager.processEvent(event);
    expect(profile.recentItems).toHaveLength(1);
    expect(profile.recentItems[0]!.contentId).toBe('content-1');
    expect(profile.totalEvents).toBe(1);
  });

  it('최근 항목이 maxRecentItems를 초과하면 자른다', () => {
    for (let i = 0; i < 10; i++) {
      manager.processEvent({
        userId: 'user-1',
        tenantId: 'tenant-1',
        contentId: `content-${i}`,
        eventType: 'view',
        timestamp: new Date().toISOString(),
      });
    }
    const profile = manager.getProfile('tenant-1', 'user-1')!;
    expect(profile.recentItems.length).toBeLessThanOrEqual(5);
  });

  it('카테고리 있는 이벤트는 관심도를 갱신한다', () => {
    manager.processEvent({
      userId: 'user-1',
      tenantId: 'tenant-1',
      contentId: 'content-1',
      eventType: 'download',
      timestamp: new Date().toISOString(),
      category: '보안',
    });
    const profile = manager.getProfile('tenant-1', 'user-1')!;
    expect(profile.interests.length).toBe(1);
    expect(profile.interests[0]!.category).toBe('보안');
    expect(profile.interests[0]!.score).toBeGreaterThan(0);
  });

  it('높은 가중치 이벤트는 더 높은 관심도를 부여한다', () => {
    // share(5.0) vs view(1.0)
    const manager2 = new UserProfileManager();
    manager2.processEvent({
      userId: 'user-1', tenantId: 't', contentId: 'c1',
      eventType: 'share', timestamp: new Date().toISOString(), category: 'AI',
    });
    const p1 = manager2.getProfile('t', 'user-1')!;
    const shareScore = p1.interests[0]!.score;

    const manager3 = new UserProfileManager();
    manager3.processEvent({
      userId: 'user-2', tenantId: 't', contentId: 'c2',
      eventType: 'view', timestamp: new Date().toISOString(), category: 'AI',
    });
    const p2 = manager3.getProfile('t', 'user-2')!;
    const viewScore = p2.interests[0]!.score;

    expect(shareScore).toBeGreaterThan(viewScore);
  });

  it('시간대 선호를 갱신한다', () => {
    const morningTime = '2026-04-11T09:00:00Z';
    manager.processEvent({
      userId: 'user-1', tenantId: 'tenant-1', contentId: 'c1',
      eventType: 'view', timestamp: morningTime,
    });
    const profile = manager.getProfile('tenant-1', 'user-1')!;
    // UTC 09:00 = KST 18:00 → afternoon
    expect(profile.preferences.preferredTimeSlot).toBeDefined();
  });

  it('배치 이벤트를 처리한다', () => {
    const events: UserEvent[] = [
      { userId: 'user-1', tenantId: 'tenant-1', contentId: 'c1', eventType: 'view', timestamp: new Date().toISOString() },
      { userId: 'user-1', tenantId: 'tenant-1', contentId: 'c2', eventType: 'click', timestamp: new Date().toISOString() },
    ];
    manager.processEvents(events);
    const profile = manager.getProfile('tenant-1', 'user-1')!;
    expect(profile.totalEvents).toBe(2);
  });
});

// -- 관심도 감쇠 ---------------------------------------------------------------

describe('UserProfileManager 감쇠', () => {
  it('감쇠를 적용하면 관심도가 줄어든다', () => {
    const manager = new UserProfileManager({ decayFactor: 0.5 });
    manager.processEvent({
      userId: 'user-1', tenantId: 't', contentId: 'c1',
      eventType: 'download', timestamp: new Date().toISOString(), category: 'AI',
    });
    const before = manager.getProfile('t', 'user-1')!.interests[0]!.score;
    manager.applyDecay();
    const after = manager.getProfile('t', 'user-1')!.interests[0]!.score;
    expect(after).toBeLessThan(before);
  });

  it('극소 점수는 감쇠 후 제거된다', () => {
    const manager = new UserProfileManager({ decayFactor: 0.001 });
    manager.processEvent({
      userId: 'user-1', tenantId: 't', contentId: 'c1',
      eventType: 'view', timestamp: new Date().toISOString(), category: 'AI',
    });
    manager.applyDecay();
    manager.applyDecay();
    const profile = manager.getProfile('t', 'user-1')!;
    expect(profile.interests).toHaveLength(0);
  });
});

// -- 임베딩 갱신 ---------------------------------------------------------------

describe('UserProfileManager 임베딩', () => {
  it('임베딩 프로바이더가 없으면 무시한다', async () => {
    const manager = new UserProfileManager();
    manager.getOrCreateProfile('t', 'user-1');
    await manager.updateEmbedding('t', 'user-1');
    expect(manager.getProfile('t', 'user-1')!.embedding).toBeUndefined();
  });

  it('임베딩 프로바이더가 있으면 임베딩을 갱신한다', async () => {
    const manager = new UserProfileManager({
      embeddingProvider: async () => [0.1, 0.2, 0.3],
    });
    manager.processEvent({
      userId: 'user-1', tenantId: 't', contentId: 'c1',
      eventType: 'view', timestamp: new Date().toISOString(), category: 'AI',
    });
    await manager.updateEmbedding('t', 'user-1');
    expect(manager.getProfile('t', 'user-1')!.embedding).toEqual([0.1, 0.2, 0.3]);
  });
});

// -- 팩토리 ------------------------------------------------------------------

describe('UserProfileManager 팩토리', () => {
  afterEach(() => {
    resetUserProfileManager();
  });

  it('싱글턴 인스턴스를 반환한다', () => {
    const m1 = getUserProfileManager();
    const m2 = getUserProfileManager();
    expect(m1).toBe(m2);
  });

  it('리셋 후 새 인스턴스를 생성한다', () => {
    const m1 = getUserProfileManager();
    resetUserProfileManager();
    const m2 = getUserProfileManager();
    expect(m1).not.toBe(m2);
  });
});
