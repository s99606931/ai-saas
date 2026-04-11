/**
 * BuildKit 캐시 최적화 엔진 테스트
 * Design Ref: MTU-N254 Design
 * Plan SC: FR-N254.1~FR-N254.5
 * CSAP: D-12 시스템 개발 보안
 */

import { BuildCacheOptimizer, CacheBackend } from '../src/build-cache-optimizer';

describe('BuildCacheOptimizer', () => {
  let optimizer: BuildCacheOptimizer;

  beforeEach(() => {
    optimizer = new BuildCacheOptimizer();
  });

  describe('recordBuild', () => {
    it('빌드 결과 기록', () => {
      const result = optimizer.recordBuild('api-gateway:v1.0', 120, [
        { description: 'FROM node:22', sizeBytes: 1000, hit: true },
        { description: 'COPY package.json', sizeBytes: 500, hit: true },
        { description: 'RUN pnpm install', sizeBytes: 2000, hit: false },
        { description: 'COPY .', sizeBytes: 800, hit: false },
      ]);

      expect(result.buildId).toMatch(/^build-/);
      expect(result.imageName).toBe('api-gateway:v1.0');
      expect(result.cacheHitLayers).toBe(2);
      expect(result.totalLayers).toBe(4);
      expect(result.cacheHitRate).toBe(0.5);
    });

    it('캐시 절약 시간 계산', () => {
      const result = optimizer.recordBuild('svc:v1', 60, [
        { description: 'layer1', sizeBytes: 100, hit: true },
        { description: 'layer2', sizeBytes: 100, hit: true },
        { description: 'layer3', sizeBytes: 100, hit: true },
      ]);

      // 히트 레이어 당 10초 절약
      expect(result.savedTimeSeconds).toBe(30);
    });

    it('빌드 히스토리 저장', () => {
      optimizer.recordBuild('svc:v1', 60, []);
      optimizer.recordBuild('svc:v2', 55, []);

      const history = optimizer.getBuildHistory();
      expect(history).toHaveLength(2);
    });
  });

  describe('getStats', () => {
    it('초기 통계', () => {
      const stats = optimizer.getStats();

      expect(stats.totalSizeBytes).toBe(0);
      expect(stats.layerCount).toBe(0);
      expect(stats.hitRate).toBe(0);
      expect(stats.totalHits).toBe(0);
      expect(stats.totalMisses).toBe(0);
    });

    it('빌드 후 통계 업데이트', () => {
      optimizer.recordBuild('svc:v1', 120, [
        { description: 'layer1', sizeBytes: 1000, hit: true },
        { description: 'layer2', sizeBytes: 2000, hit: false },
      ]);

      const stats = optimizer.getStats();

      expect(stats.totalSizeBytes).toBe(3000);
      expect(stats.layerCount).toBe(2);
      expect(stats.hitRate).toBe(0.5);
      expect(stats.totalHits).toBe(1);
      expect(stats.totalMisses).toBe(1);
    });

    it('여러 빌드 후 누적 통계', () => {
      optimizer.recordBuild('svc:v1', 60, [
        { description: 'base', sizeBytes: 1000, hit: true },
      ]);
      optimizer.recordBuild('svc:v2', 55, [
        { description: 'base', sizeBytes: 1000, hit: true },
        { description: 'app', sizeBytes: 500, hit: false },
      ]);

      const stats = optimizer.getStats();

      expect(stats.totalHits).toBe(2);
      expect(stats.totalMisses).toBe(1);
      expect(stats.hitRate).toBeCloseTo(0.6667, 3);
    });
  });

  describe('runGC', () => {
    it('빈 캐시 GC 실행', () => {
      const result = optimizer.runGC();

      expect(result.removedLayers).toBe(0);
      expect(result.reclaimedBytes).toBe(0);
    });

    it('오래된 레이어 제거', () => {
      // 레이어 추가
      optimizer.recordBuild('svc:v1', 60, [
        { description: 'old-layer', sizeBytes: 1000, hit: false },
      ]);

      // GC 정책을 0일로 설정 (즉시 만료)
      const gcOptimizer = new BuildCacheOptimizer({ maxAgeDays: 0 });
      gcOptimizer.recordBuild('svc:v1', 60, [
        { description: 'old-layer', sizeBytes: 1000, hit: false },
      ]);

      const result = gcOptimizer.runGC();

      expect(result.removedLayers).toBe(1);
      expect(result.reclaimedBytes).toBe(1000);
    });

    it('GC 실행 시각 기록', () => {
      const stats1 = optimizer.getStats();
      expect(stats1.lastGcAt).toBeNull();

      optimizer.runGC();

      const stats2 = optimizer.getStats();
      expect(stats2.lastGcAt).not.toBeNull();
    });

    it('크기 초과 시 LRU 제거', () => {
      const smallCacheOptimizer = new BuildCacheOptimizer({
        maxSizeBytes: 500,
        maxAgeDays: 365,
      });

      smallCacheOptimizer.recordBuild('svc:v1', 60, [
        { description: 'layer1', sizeBytes: 300, hit: false },
        { description: 'layer2', sizeBytes: 300, hit: false },
        { description: 'layer3', sizeBytes: 300, hit: false },
      ]);

      const result = smallCacheOptimizer.runGC();

      expect(result.removedLayers).toBeGreaterThan(0);
      expect(result.remainingSizeBytes).toBeLessThanOrEqual(500);
    });
  });

  describe('analyzeDockerfile', () => {
    it('COPY . 전 package.json 미분리 감지', () => {
      const dockerfile = `
FROM node:22
COPY . .
RUN pnpm install
`;
      const recs = optimizer.analyzeDockerfile(dockerfile);
      const df001 = recs.find(r => r.ruleId === 'DF-001');

      expect(df001).toBeTruthy();
      expect(df001!.severity).toBe('high');
    });

    it('멀티스테이지 빌드 미사용 감지', () => {
      const dockerfile = `
FROM node:22
COPY . .
RUN pnpm build
`;
      const recs = optimizer.analyzeDockerfile(dockerfile);
      const df002 = recs.find(r => r.ruleId === 'DF-002');

      expect(df002).toBeTruthy();
    });

    it(':latest 태그 사용 감지', () => {
      const dockerfile = `
FROM node:latest
COPY . .
`;
      const recs = optimizer.analyzeDockerfile(dockerfile);
      const df005 = recs.find(r => r.ruleId === 'DF-005');

      expect(df005).toBeTruthy();
      expect(df005!.severity).toBe('high');
    });

    it('최적화된 Dockerfile은 권고 없음 (또는 최소)', () => {
      const dockerfile = `
FROM node:22-alpine3.19 AS builder
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm build

FROM node:22-alpine3.19 AS runtime
COPY --from=builder /app/dist ./dist
CMD ["node", "dist/index.js"]
`;
      const recs = optimizer.analyzeDockerfile(dockerfile);

      // DF-001(package 미분리), DF-002(멀티스테이지), DF-005(latest) 없어야 함
      expect(recs.find(r => r.ruleId === 'DF-001')).toBeUndefined();
      expect(recs.find(r => r.ruleId === 'DF-002')).toBeUndefined();
      expect(recs.find(r => r.ruleId === 'DF-005')).toBeUndefined();
    });

    it('apt-get 캐시 미정리 감지', () => {
      const dockerfile = `
FROM ubuntu:22.04
RUN apt-get update && apt-get install -y curl
`;
      const recs = optimizer.analyzeDockerfile(dockerfile);
      const df003 = recs.find(r => r.ruleId === 'DF-003');

      expect(df003).toBeTruthy();
    });

    it('과다 RUN 명령 감지', () => {
      const dockerfile = `
FROM node:22
RUN mkdir /app
RUN cd /app
RUN echo "a"
RUN echo "b"
RUN echo "c"
RUN echo "d"
`;
      const recs = optimizer.analyzeDockerfile(dockerfile);
      const df006 = recs.find(r => r.ruleId === 'DF-006');

      expect(df006).toBeTruthy();
    });
  });

  describe('빌드 히스토리', () => {
    it('히스토리 제한', () => {
      for (let i = 0; i < 5; i++) {
        optimizer.recordBuild(`svc:v${i}`, 60, []);
      }

      const limited = optimizer.getBuildHistory(3);
      expect(limited).toHaveLength(3);
    });
  });
});
