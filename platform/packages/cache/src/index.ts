// @public-saas/cache -- 공유 캐싱 패키지
// Design Ref: SVC-CACHE-R7 Plan
// Plan SC: FR-CACHE.1

export { CacheStore, type CacheConfig, type CacheStats } from './cache-store.js';
export { cachePlugin, createCacheMiddleware, type CachePluginOptions } from './cache-plugin.js';
