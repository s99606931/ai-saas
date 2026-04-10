// 세션 관리 (Redis)
// Design Ref: DESIGN-MTU-P01 Section 4
// Plan SC: FR-P01.4, FR-P01.7
// CSAP: D-08-02 세션 관리, D-08-04 동시 접속 제한

import Redis from 'ioredis';
import { AUTH_CONSTANTS } from '@public-saas/auth-sdk';

const redis = new Redis(process.env['REDIS_URL'] ?? 'redis://localhost:6379');

const SESSION_KEY = (userId: string): string => `sessions:${userId}`;
const BLACKLIST_KEY = (token: string): string => `blacklist:${token}`;

interface SessionData {
  token: string;
  refreshToken: string;
  ip: string;
  userAgent: string;
  createdAt: string;
}

/**
 * 세션 생성
 * CSAP D-08-04: 동시 세션 최대 3개, FIFO 만료
 *
 * @param userId - 사용자 ID
 * @param sessionData - 세션 데이터
 */
export async function createSession(userId: string, sessionData: SessionData): Promise<void> {
  const key = SESSION_KEY(userId);
  const sessions = await redis.lrange(key, 0, -1);

  // 동시 세션 제한: 가장 오래된 세션 강제 만료
  if (sessions.length >= AUTH_CONSTANTS.MAX_CONCURRENT_SESSIONS) {
    const oldestRaw = await redis.lpop(key);
    if (oldestRaw) {
      const oldest = JSON.parse(oldestRaw) as SessionData;
      await blacklistToken(oldest.token);
      if (oldest.refreshToken) {
        await blacklistToken(oldest.refreshToken);
      }
    }
  }

  await redis.rpush(key, JSON.stringify(sessionData));
  // 세션 목록 TTL = 갱신 토큰 만료 시간
  await redis.expire(key, AUTH_CONSTANTS.REFRESH_TOKEN_EXPIRES_SECONDS);
}

/**
 * 세션 제거 (로그아웃)
 *
 * @param userId - 사용자 ID
 * @param token - 접근 토큰
 */
export async function removeSession(userId: string, token: string): Promise<void> {
  const key = SESSION_KEY(userId);
  const sessions = await redis.lrange(key, 0, -1);

  for (const raw of sessions) {
    const session = JSON.parse(raw) as SessionData;
    if (session.token === token || session.refreshToken === token) {
      await redis.lrem(key, 1, raw);
      await blacklistToken(session.token);
      if (session.refreshToken) {
        await blacklistToken(session.refreshToken);
      }
      break;
    }
  }
}

/**
 * 토큰 블랙리스트 등록
 * CSAP D-08-03: 로그아웃 시 토큰 무효화
 *
 * TTL은 갱신 토큰 만료시간(7일)으로 설정하여
 * 블랙리스트된 리프레시 토큰이 TTL 만료로 재사용되는 것을 방지합니다.
 * (접근 토큰은 15분이지만, 동일 블랙리스트에 혼용되므로 안전한 쪽으로 통일)
 *
 * @param token - 블랙리스트에 등록할 토큰
 */
export async function blacklistToken(token: string): Promise<void> {
  await redis.set(BLACKLIST_KEY(token), '1', 'EX', AUTH_CONSTANTS.REFRESH_TOKEN_EXPIRES_SECONDS);
}

/**
 * 토큰이 블랙리스트에 있는지 확인
 *
 * @param token - 확인할 토큰
 * @returns 블랙리스트 여부
 */
export async function isTokenBlacklisted(token: string): Promise<boolean> {
  const result = await redis.get(BLACKLIST_KEY(token));
  return result !== null;
}

export { redis };
