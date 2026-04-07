// 세션 관리 + 토큰 블랙리스트 테스트 (모킹)
// Design Ref: DESIGN-MTU-P01 Section 4
// Plan SC: FR-P01.4, FR-P01.7
// CSAP: D-08-02 세션 관리, D-08-03 로그아웃, D-08-04 동시 접속 제한

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Redis 모킹
const mockRedis = {
  lrange: vi.fn().mockResolvedValue([]),
  lpop: vi.fn().mockResolvedValue(null),
  rpush: vi.fn().mockResolvedValue(1),
  expire: vi.fn().mockResolvedValue(1),
  set: vi.fn().mockResolvedValue('OK'),
  get: vi.fn().mockResolvedValue(null),
  lrem: vi.fn().mockResolvedValue(1),
  del: vi.fn().mockResolvedValue(1),
  ping: vi.fn().mockResolvedValue('PONG'),
};

vi.mock('ioredis', () => ({
  default: vi.fn(() => mockRedis),
}));

describe('세션 관리 (CSAP D-08-02, D-08-04)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('createSession: 새 세션을 Redis 리스트에 추가한다', async () => {
    const { createSession } = await import('../../src/lib/session.js');

    await createSession('user-1', {
      token: 'access-token-1',
      refreshToken: 'refresh-token-1',
      ip: '127.0.0.1',
      userAgent: 'test',
      createdAt: '2026-04-07T00:00:00.000Z',
    });

    expect(mockRedis.rpush).toHaveBeenCalledWith(
      'sessions:user-1',
      expect.stringContaining('access-token-1'),
    );
  });

  it('createSession: 동시 세션 3개 초과 시 가장 오래된 세션을 제거한다', async () => {
    mockRedis.lrange.mockResolvedValueOnce([
      JSON.stringify({ token: 't1', refreshToken: 'r1', ip: '1.1.1.1', userAgent: 'a', createdAt: '' }),
      JSON.stringify({ token: 't2', refreshToken: 'r2', ip: '2.2.2.2', userAgent: 'b', createdAt: '' }),
      JSON.stringify({ token: 't3', refreshToken: 'r3', ip: '3.3.3.3', userAgent: 'c', createdAt: '' }),
    ]);
    mockRedis.lpop.mockResolvedValueOnce(
      JSON.stringify({ token: 't1', refreshToken: 'r1', ip: '1.1.1.1', userAgent: 'a', createdAt: '' }),
    );

    const { createSession } = await import('../../src/lib/session.js');

    await createSession('user-1', {
      token: 'access-token-4',
      refreshToken: 'refresh-token-4',
      ip: '4.4.4.4',
      userAgent: 'test',
      createdAt: '2026-04-07T00:00:00.000Z',
    });

    // 가장 오래된 세션 제거 (lpop)
    expect(mockRedis.lpop).toHaveBeenCalled();
    // 오래된 토큰 블랙리스트 등록
    expect(mockRedis.set).toHaveBeenCalledWith(
      'blacklist:t1',
      '1',
      'EX',
      expect.any(Number),
    );
  });

  it('blacklistToken: 토큰을 블랙리스트에 등록한다', async () => {
    const { blacklistToken } = await import('../../src/lib/session.js');

    await blacklistToken('some-token');

    expect(mockRedis.set).toHaveBeenCalledWith(
      'blacklist:some-token',
      '1',
      'EX',
      expect.any(Number),
    );
  });

  it('isTokenBlacklisted: 블랙리스트에 있으면 true를 반환한다', async () => {
    mockRedis.get.mockResolvedValueOnce('1');
    const { isTokenBlacklisted } = await import('../../src/lib/session.js');

    const result = await isTokenBlacklisted('blocked-token');
    expect(result).toBe(true);
  });

  it('isTokenBlacklisted: 블랙리스트에 없으면 false를 반환한다', async () => {
    mockRedis.get.mockResolvedValueOnce(null);
    const { isTokenBlacklisted } = await import('../../src/lib/session.js');

    const result = await isTokenBlacklisted('valid-token');
    expect(result).toBe(false);
  });

  it('removeSession: 특정 토큰의 세션을 제거하고 블랙리스트에 등록한다', async () => {
    const sessionData = JSON.stringify({
      token: 'target-token',
      refreshToken: 'target-refresh',
      ip: '1.1.1.1',
      userAgent: 'test',
      createdAt: '',
    });
    mockRedis.lrange.mockResolvedValueOnce([sessionData]);

    const { removeSession } = await import('../../src/lib/session.js');

    await removeSession('user-1', 'target-token');

    expect(mockRedis.lrem).toHaveBeenCalledWith('sessions:user-1', 1, sessionData);
    expect(mockRedis.set).toHaveBeenCalledWith(
      'blacklist:target-token',
      '1',
      'EX',
      expect.any(Number),
    );
  });
});
