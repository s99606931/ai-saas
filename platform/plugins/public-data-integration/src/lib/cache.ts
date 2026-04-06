// Design Ref: MTU-ECO3 Design 2.2
// Plan SC: FR-ECO3.7

/**
 * Redis 캐싱 미들웨어
 *
 * 공공데이터 API 응답을 Redis에 캐싱하여 API 호출 횟수를 절감합니다.
 * 캐시 TTL: 기본 1시간 (데이터셋별 설정 가능)
 */

const DEFAULT_TTL = 3600; // 1시간 (초)

interface CacheEntry {
  data: unknown;
  cachedAt: string;
  ttl: number;
}

/**
 * 인메모리 캐시 (Redis 미설정 시 폴백)
 * 실제 프로덕션에서는 Redis 클라이언트로 교체
 */
const memoryCache = new Map<string, CacheEntry>();

/**
 * 캐시에서 데이터 조회
 */
export async function getCached(key: string): Promise<unknown | null> {
  // NOTE: 실제 구현에서는 Redis GET 명령 사용
  // const redisClient = getRedisClient();
  // const cached = await redisClient.get(`public-data:${key}`);

  const entry = memoryCache.get(key);
  if (!entry) return null;

  const elapsed = (Date.now() - new Date(entry.cachedAt).getTime()) / 1000;
  if (elapsed > entry.ttl) {
    memoryCache.delete(key);
    return null;
  }

  return entry.data;
}

/**
 * 캐시에 데이터 저장
 */
export async function setCache(key: string, data: unknown, ttl: number = DEFAULT_TTL): Promise<void> {
  // NOTE: 실제 구현에서는 Redis SET EX 명령 사용
  // const redisClient = getRedisClient();
  // await redisClient.set(`public-data:${key}`, JSON.stringify(data), 'EX', ttl);

  memoryCache.set(key, {
    data,
    cachedAt: new Date().toISOString(),
    ttl,
  });
}

/**
 * 캐시 무효화
 */
export async function invalidateCache(key: string): Promise<void> {
  memoryCache.delete(key);
}

/**
 * 전체 캐시 통계
 */
export function getCacheStats(): { size: number; keys: string[] } {
  return {
    size: memoryCache.size,
    keys: [...memoryCache.keys()],
  };
}
