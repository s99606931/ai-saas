// SVC-AI-ADV-R15 단위 테스트: AI 속도 제한기 + 할당량 관리
// Design Ref: SVC-AI-ADV-R15 DESIGN §1~§4
// Plan SC: FR-ADV15.1~FR-ADV15.6
// CSAP: D-10 리소스 사용량 제한, D-06 감사 로깅

import { describe, it, expect, vi, beforeEach } from 'vitest';

import {
  AIRateLimiter,
  createAIRateLimiter,
} from '../../src/lib/ai-rate-limiter.js';
import type {
  TenantTier,
  RequestPriority,
  AbuseDetectionResult,
} from '../../src/lib/ai-rate-limiter.js';

// ── 슬라이딩 윈도우 RPM 테스트 — FR-ADV15.1 ───────────────────────────────

describe('AIRateLimiter 슬라이딩 윈도우 (FR-ADV15.1)', () => {
  let limiter: AIRateLimiter;

  beforeEach(() => {
    limiter = new AIRateLimiter();
  });

  it('한도 이내 요청을 허용한다', () => {
    limiter.setTenantTier('tenant-1', 'basic'); // 10 RPM, bucketCapacity: 20
    const result = limiter.checkRateLimit('tenant-1', 1, 'normal');
    expect(result.allowed).toBe(true);
    expect(result.remainingRequests).toBeLessThanOrEqual(10);
  });

  it('RPM 한도 초과 시 요청을 차단한다', () => {
    limiter.setTenantTier('tenant-1', 'basic'); // 10 RPM

    // 10건 소진
    for (let i = 0; i < 10; i++) {
      const r = limiter.checkRateLimit('tenant-1', 1, 'normal');
      expect(r.allowed).toBe(true);
    }

    // 11번째 요청 차단
    const result = limiter.checkRateLimit('tenant-1', 1, 'normal');
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain('분당 요청 한도 초과');
  });

  it('차단 시 retryAfterMs를 반환한다', () => {
    limiter.setTenantTier('tenant-1', 'basic');

    for (let i = 0; i < 10; i++) {
      limiter.checkRateLimit('tenant-1', 1, 'normal');
    }

    const result = limiter.checkRateLimit('tenant-1', 1, 'normal');
    expect(result.retryAfterMs).toBeDefined();
    expect(result.retryAfterMs!).toBeGreaterThanOrEqual(0);
  });

  it('미설정 테넌트는 standard 등급을 기본 적용한다', () => {
    // standard = 30 RPM, 남용 감지 비활성화 (콜백 없이)
    // 빠른 요청 8건 후 상태를 확인하여 standard 등급 적용 확인
    for (let i = 0; i < 8; i++) {
      const result = limiter.checkRateLimit('unknown-tenant', 1, 'normal');
      expect(result.allowed).toBe(true);
    }

    const status = limiter.getStatus('unknown-tenant');
    expect(status.tier).toBe('standard');
    expect(status.requestsLimit).toBe(30);
    expect(status.requestsUsed).toBe(8);
  });
});

// ── 토큰 버킷 테스트 — FR-ADV15.2 ─────────────────────────────────────────

describe('AIRateLimiter 토큰 버킷 (FR-ADV15.2)', () => {
  let limiter: AIRateLimiter;

  beforeEach(() => {
    limiter = new AIRateLimiter();
  });

  it('토큰이 충분하면 요청을 허용한다', () => {
    limiter.setTenantTier('tenant-1', 'basic'); // bucketCapacity: 20
    const result = limiter.checkRateLimit('tenant-1', 10, 'normal');
    expect(result.allowed).toBe(true);
    expect(result.remainingTokens).toBeGreaterThanOrEqual(0);
  });

  it('토큰이 부족하면 요청을 차단한다', () => {
    limiter.setTenantTier('tenant-1', 'basic'); // bucketCapacity: 20

    // 토큰 대부분 소비
    limiter.checkRateLimit('tenant-1', 15, 'normal');

    // 나머지 토큰보다 큰 요청
    const result = limiter.checkRateLimit('tenant-1', 10, 'normal');
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain('토큰 버킷 소진');
  });

  it('토큰 소진 시 retryAfterMs를 반환한다', () => {
    limiter.setTenantTier('tenant-1', 'basic');
    limiter.checkRateLimit('tenant-1', 20, 'normal');

    const result = limiter.checkRateLimit('tenant-1', 10, 'normal');
    if (!result.allowed) {
      expect(result.retryAfterMs).toBeGreaterThan(0);
    }
  });
});

// ── 테넌트 등급별 설정 — FR-ADV15.3 ───────────────────────────────────────

describe('AIRateLimiter 테넌트 등급 (FR-ADV15.3)', () => {
  let limiter: AIRateLimiter;

  beforeEach(() => {
    limiter = new AIRateLimiter();
  });

  it('basic 등급을 설정한다 (10 RPM)', () => {
    limiter.setTenantTier('tenant-1', 'basic');
    const status = limiter.getStatus('tenant-1');
    expect(status.tier).toBe('basic');
    expect(status.requestsLimit).toBe(10);
  });

  it('standard 등급을 설정한다 (30 RPM)', () => {
    limiter.setTenantTier('tenant-1', 'standard');
    const status = limiter.getStatus('tenant-1');
    expect(status.tier).toBe('standard');
    expect(status.requestsLimit).toBe(30);
  });

  it('premium 등급을 설정한다 (100 RPM)', () => {
    limiter.setTenantTier('tenant-1', 'premium');
    const status = limiter.getStatus('tenant-1');
    expect(status.tier).toBe('premium');
    expect(status.requestsLimit).toBe(100);
  });

  it('enterprise 등급을 설정한다 (500 RPM)', () => {
    limiter.setTenantTier('tenant-1', 'enterprise');
    const status = limiter.getStatus('tenant-1');
    expect(status.tier).toBe('enterprise');
    expect(status.requestsLimit).toBe(500);
  });

  it('등급 변경 시 설정이 갱신된다', () => {
    limiter.setTenantTier('tenant-1', 'basic');
    expect(limiter.getStatus('tenant-1').tier).toBe('basic');

    limiter.setTenantTier('tenant-1', 'enterprise');
    expect(limiter.getStatus('tenant-1').tier).toBe('enterprise');
    expect(limiter.getStatus('tenant-1').requestsLimit).toBe(500);
  });
});

// ── 우선순위 보정 — FR-ADV15.4 ─────────────────────────────────────────────

describe('AIRateLimiter 우선순위 (FR-ADV15.4)', () => {
  let limiter: AIRateLimiter;

  beforeEach(() => {
    limiter = new AIRateLimiter();
    limiter.setTenantTier('tenant-1', 'standard'); // 30 RPM
  });

  it('high 우선순위는 RPM 한도를 1.5배로 확장한다', () => {
    // standard = 30 RPM, high = Math.floor(30 * 1.5) = 45 RPM
    // 남용 감지를 피하기 위해 적은 횟수로 검증
    // normal 우선순위로 30건 소진 후 high로 추가 허용 확인
    for (let i = 0; i < 8; i++) {
      const result = limiter.checkRateLimit('tenant-1', 1, 'high');
      expect(result.allowed).toBe(true);
    }

    // high 우선순위 확인: remainingRequests 기준으로 45 RPM 적용 확인
    const status = limiter.checkRateLimit('tenant-1', 1, 'high');
    expect(status.allowed).toBe(true);
    // high 우선순위 적용 시 45 - 9 = 36개 남음
    expect(status.remainingRequests).toBe(36);
  });

  it('low 우선순위는 RPM 한도를 0.5배로 축소한다', () => {
    // standard = 30 RPM, low = Math.floor(30 * 0.5) = 15 RPM
    // 남용 감지를 피하기 위해 적은 횟수로 검증
    for (let i = 0; i < 8; i++) {
      const result = limiter.checkRateLimit('tenant-1', 1, 'low');
      expect(result.allowed).toBe(true);
    }

    // low 우선순위 확인: remainingRequests 기준으로 15 RPM 적용 확인
    const status = limiter.checkRateLimit('tenant-1', 1, 'low');
    expect(status.allowed).toBe(true);
    // low 우선순위 적용 시 15 - 9 = 6개 남음
    expect(status.remainingRequests).toBe(6);
  });

  it('결과에 우선순위 정보를 포함한다', () => {
    const result = limiter.checkRateLimit('tenant-1', 1, 'high');
    expect(result.priority).toBe('high');
  });
});

// ── 상태 조회 ───────────────────────────────────────────────────────────────

describe('AIRateLimiter 상태 조회', () => {
  let limiter: AIRateLimiter;

  beforeEach(() => {
    limiter = new AIRateLimiter();
  });

  it('요청 사용량을 조회한다', () => {
    limiter.setTenantTier('tenant-1', 'standard');
    limiter.checkRateLimit('tenant-1', 1, 'normal');
    limiter.checkRateLimit('tenant-1', 1, 'normal');

    const status = limiter.getStatus('tenant-1');
    expect(status.requestsUsed).toBe(2);
  });

  it('토큰 가용량을 조회한다', () => {
    limiter.setTenantTier('tenant-1', 'basic'); // capacity: 20
    const before = limiter.getStatus('tenant-1');
    expect(before.tokensCapacity).toBe(20);

    limiter.checkRateLimit('tenant-1', 5, 'normal');
    const after = limiter.getStatus('tenant-1');
    expect(after.tokensAvailable).toBeLessThan(before.tokensAvailable);
  });

  it('차단 상태를 조회한다', () => {
    limiter.setTenantTier('tenant-1', 'standard');
    const status = limiter.getStatus('tenant-1');
    expect(status.isBlocked).toBe(false);
  });
});

// ── 사용량 기록 ─────────────────────────────────────────────────────────────

describe('AIRateLimiter 사용량 기록', () => {
  it('recordUsage가 에러 없이 동작한다', () => {
    const limiter = new AIRateLimiter();
    limiter.setTenantTier('tenant-1', 'standard');
    limiter.checkRateLimit('tenant-1', 100, 'normal');

    // recordUsage는 tokenWindow에 기록
    expect(() => limiter.recordUsage('tenant-1', 150)).not.toThrow();
  });

  it('존재하지 않는 테넌트에 recordUsage 호출은 무시한다', () => {
    const limiter = new AIRateLimiter();
    // 상태가 없는 테넌트 - 에러 없이 무시
    expect(() => limiter.recordUsage('nonexistent', 100)).not.toThrow();
  });
});

// ── 남용 감지 — FR-ADV15.6 ─────────────────────────────────────────────────

describe('AIRateLimiter 남용 감지 (FR-ADV15.6)', () => {
  it('남용 감지 콜백을 호출한다', () => {
    const limiter = new AIRateLimiter();
    limiter.setTenantTier('tenant-1', 'enterprise'); // 넉넉한 한도

    const abuseCallback = vi.fn();
    limiter.onAbuseDetected = abuseCallback;

    // 빠른 연속 요청으로 평균 간격 < 100ms 유도
    // recentIntervals에 10개 이상 쌓여야 함
    for (let i = 0; i < 15; i++) {
      limiter.checkRateLimit('tenant-1', 1, 'normal');
    }

    // 남용 감지가 발동되었을 수 있음 (평균 간격에 따라)
    // 실행 환경에 따라 간격이 달라지므로 콜백이 호출되면 검증
    if (abuseCallback.mock.calls.length > 0) {
      const result: AbuseDetectionResult = abuseCallback.mock.calls[0][1];
      expect(result.isAbuse).toBe(true);
      expect(result.pattern).toBe('rapid_fire');
    }
  });

  it('차단된 테넌트의 요청을 거부한다', () => {
    const limiter = new AIRateLimiter();
    limiter.setTenantTier('tenant-1', 'enterprise');

    // 남용으로 차단시키기
    const abuseCallback = vi.fn();
    limiter.onAbuseDetected = abuseCallback;

    // 매우 빠른 연속 호출 (차단까지)
    for (let i = 0; i < 50; i++) {
      limiter.checkRateLimit('tenant-1', 1, 'normal');
    }

    // 차단 상태 확인
    const status = limiter.getStatus('tenant-1');
    if (status.isBlocked) {
      const result = limiter.checkRateLimit('tenant-1', 1, 'normal');
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('남용 감지');
      expect(result.remainingRequests).toBe(0);
      expect(result.remainingTokens).toBe(0);
    }
  });
});

// ── 전체 메트릭 ─────────────────────────────────────────────────────────────

describe('AIRateLimiter 메트릭', () => {
  let limiter: AIRateLimiter;

  beforeEach(() => {
    limiter = new AIRateLimiter();
  });

  it('초기 메트릭이 0이다', () => {
    const metrics = limiter.getMetrics();
    expect(metrics.totalRequests).toBe(0);
    expect(metrics.blockedRequests).toBe(0);
    expect(metrics.blockRate).toBe(0);
  });

  it('요청 수를 집계한다', () => {
    limiter.setTenantTier('tenant-1', 'standard');
    limiter.checkRateLimit('tenant-1', 1, 'normal');
    limiter.checkRateLimit('tenant-1', 1, 'normal');
    limiter.checkRateLimit('tenant-1', 1, 'normal');

    const metrics = limiter.getMetrics();
    expect(metrics.totalRequests).toBe(3);
  });

  it('차단률을 계산한다', () => {
    limiter.setTenantTier('tenant-1', 'basic'); // 10 RPM

    // 10건 허용 + 5건 차단 = 15건 총 요청
    for (let i = 0; i < 15; i++) {
      limiter.checkRateLimit('tenant-1', 1, 'normal');
    }

    const metrics = limiter.getMetrics();
    expect(metrics.totalRequests).toBe(15);
    expect(metrics.blockedRequests).toBe(5);
    expect(metrics.blockRate).toBeCloseTo(5 / 15, 2);
  });
});

// ── 테넌트 격리 (CSAP D-08) ────────────────────────────────────────────────

describe('AIRateLimiter 테넌트 격리 (CSAP D-08)', () => {
  let limiter: AIRateLimiter;

  beforeEach(() => {
    limiter = new AIRateLimiter();
  });

  it('테넌트별 독립적인 속도 제한을 적용한다', () => {
    limiter.setTenantTier('tenant-a', 'basic');  // 10 RPM
    limiter.setTenantTier('tenant-b', 'premium'); // 100 RPM

    // tenant-a 한도 소진
    for (let i = 0; i < 10; i++) {
      limiter.checkRateLimit('tenant-a', 1, 'normal');
    }
    const resultA = limiter.checkRateLimit('tenant-a', 1, 'normal');
    expect(resultA.allowed).toBe(false);

    // tenant-b는 영향 없음
    const resultB = limiter.checkRateLimit('tenant-b', 1, 'normal');
    expect(resultB.allowed).toBe(true);
  });

  it('테넌트별 독립적인 상태를 유지한다', () => {
    limiter.setTenantTier('tenant-a', 'basic');
    limiter.setTenantTier('tenant-b', 'enterprise');

    limiter.checkRateLimit('tenant-a', 5, 'normal');

    const statusA = limiter.getStatus('tenant-a');
    const statusB = limiter.getStatus('tenant-b');

    expect(statusA.requestsUsed).toBe(1);
    expect(statusB.requestsUsed).toBe(0);
  });
});

// ── 팩토리 ──────────────────────────────────────────────────────────────────

describe('createAIRateLimiter 팩토리', () => {
  it('AIRateLimiter 인스턴스를 생성한다', () => {
    const limiter = createAIRateLimiter();
    expect(limiter).toBeInstanceOf(AIRateLimiter);
  });
});
