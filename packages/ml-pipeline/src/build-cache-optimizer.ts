/**
 * BuildKit 캐시 최적화 엔진
 * Design Ref: docs/02-design/mtus/MTU-N254-buildkit-cache.design.md
 * Plan SC: FR-N254.1~FR-N254.5
 *
 * BuildKit 원격 캐시 설정, pnpm store 캐시 공유, 레이어 캐시 최적화
 * 캐시 히트율 추적 및 GC 정책 관리
 * CSAP D-12 시스템 개발 보안 (빌드 재현성 보장)
 */

/** 캐시 백엔드 유형 */
export enum CacheBackend {
  /** 로컬 디스크 */
  Local = 'local',
  /** Harbor OCI 레지스트리 */
  Registry = 'registry',
  /** S3 호환 객체 스토리지 */
  S3 = 's3',
  /** GitHub Actions Cache */
  GHA = 'gha',
}

/** 캐시 레이어 정보 */
export interface CacheLayer {
  /** 레이어 ID */
  id: string;
  /** 레이어 크기 (bytes) */
  sizeBytes: number;
  /** 캐시 히트 여부 */
  hit: boolean;
  /** 레이어 설명 */
  description: string;
  /** 생성 시각 */
  createdAt: string;
  /** 마지막 접근 시각 */
  lastAccessedAt: string;
}

/** 빌드 캐시 통계 */
export interface CacheStats {
  /** 전체 캐시 크기 (bytes) */
  totalSizeBytes: number;
  /** 캐시 레이어 수 */
  layerCount: number;
  /** 캐시 히트율 (0.0 ~ 1.0) */
  hitRate: number;
  /** 총 히트 수 */
  totalHits: number;
  /** 총 미스 수 */
  totalMisses: number;
  /** 캐시 절약 시간 (초) */
  savedTimeSeconds: number;
  /** 마지막 GC 시각 */
  lastGcAt: string | null;
}

/** 빌드 결과 */
export interface BuildResult {
  /** 빌드 ID */
  buildId: string;
  /** 이미지 이름 */
  imageName: string;
  /** 빌드 소요 시간 (초) */
  durationSeconds: number;
  /** 캐시 히트 레이어 수 */
  cacheHitLayers: number;
  /** 전체 레이어 수 */
  totalLayers: number;
  /** 캐시 히트율 (0.0 ~ 1.0) */
  cacheHitRate: number;
  /** 캐시로 절약된 시간 (초) */
  savedTimeSeconds: number;
  /** 빌드 시각 */
  builtAt: string;
}

/** GC 정책 */
export interface GCPolicy {
  /** 최대 캐시 크기 (bytes) */
  maxSizeBytes: number;
  /** 최대 보관 기간 (일) */
  maxAgeDays: number;
  /** 최소 히트율 임계값 (0.0 ~ 1.0, 이하이면 제거 우선) */
  minHitRate: number;
  /** GC 실행 간격 (시간) */
  intervalHours: number;
}

/** GC 결과 */
export interface GCResult {
  /** 제거된 레이어 수 */
  removedLayers: number;
  /** 회수된 공간 (bytes) */
  reclaimedBytes: number;
  /** 남은 레이어 수 */
  remainingLayers: number;
  /** 남은 캐시 크기 (bytes) */
  remainingSizeBytes: number;
  /** GC 소요 시간 (ms) */
  durationMs: number;
  /** GC 시각 */
  executedAt: string;
}

/** Dockerfile 최적화 권고 */
export interface DockerfileRecommendation {
  /** 규칙 ID */
  ruleId: string;
  /** 심각도 */
  severity: 'high' | 'medium' | 'low';
  /** 설명 */
  description: string;
  /** 권고 조치 */
  recommendation: string;
}

const DEFAULT_GC_POLICY: GCPolicy = {
  maxSizeBytes: 10 * 1024 * 1024 * 1024, // 10GB
  maxAgeDays: 14,
  minHitRate: 0.1,
  intervalHours: 24,
};

export class BuildCacheOptimizer {
  private layers: CacheLayer[] = [];
  private buildHistory: BuildResult[] = [];
  private totalHits = 0;
  private totalMisses = 0;
  private totalSavedTime = 0;
  private lastGcAt: string | null = null;
  private readonly gcPolicy: GCPolicy;
  private readonly maxHistory = 1000;
  private readonly maxLayers = 10000;

  constructor(gcPolicy?: Partial<GCPolicy>) {
    this.gcPolicy = { ...DEFAULT_GC_POLICY, ...gcPolicy };
  }

  /**
   * 빌드 결과 기록
   * Design Ref: §FR-N254.4 — 캐시 히트율 모니터링
   */
  recordBuild(
    imageName: string,
    durationSeconds: number,
    layers: Array<{ description: string; sizeBytes: number; hit: boolean }>,
  ): BuildResult {
    const cacheHitLayers = layers.filter(l => l.hit).length;
    const totalLayers = layers.length;
    const cacheHitRate = totalLayers > 0 ? cacheHitLayers / totalLayers : 0;

    // 캐시 히트 시간 절약 추정: 히트 레이어 당 평균 10초 절약
    const savedTimeSeconds = cacheHitLayers * 10;

    // 통계 업데이트
    this.totalHits += cacheHitLayers;
    this.totalMisses += (totalLayers - cacheHitLayers);
    this.totalSavedTime += savedTimeSeconds;

    // 레이어 기록
    const now = new Date().toISOString();
    for (const layer of layers) {
      const existing = this.layers.find(l => l.description === layer.description);
      if (existing) {
        existing.lastAccessedAt = now;
        if (layer.hit) {
          existing.hit = true;
        }
      } else {
        this.layers.push({
          id: `layer-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          sizeBytes: layer.sizeBytes,
          hit: layer.hit,
          description: layer.description,
          createdAt: now,
          lastAccessedAt: now,
        });
      }
    }

    // 레이어 수 제한
    if (this.layers.length > this.maxLayers) {
      this.layers = this.layers.slice(-this.maxLayers);
    }

    const result: BuildResult = {
      buildId: `build-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      imageName,
      durationSeconds,
      cacheHitLayers,
      totalLayers,
      cacheHitRate: Math.round(cacheHitRate * 10000) / 10000,
      savedTimeSeconds,
      builtAt: now,
    };

    // 빌드 히스토리 저장
    this.buildHistory.push(result);
    if (this.buildHistory.length > this.maxHistory) {
      this.buildHistory = this.buildHistory.slice(-this.maxHistory);
    }

    return result;
  }

  /**
   * 캐시 통계 조회
   * Design Ref: §FR-N254.4 — 캐시 히트율 모니터링
   */
  getStats(): CacheStats {
    const totalSizeBytes = this.layers.reduce((sum, l) => sum + l.sizeBytes, 0);
    const totalRequests = this.totalHits + this.totalMisses;

    return {
      totalSizeBytes,
      layerCount: this.layers.length,
      hitRate: totalRequests > 0
        ? Math.round((this.totalHits / totalRequests) * 10000) / 10000
        : 0,
      totalHits: this.totalHits,
      totalMisses: this.totalMisses,
      savedTimeSeconds: this.totalSavedTime,
      lastGcAt: this.lastGcAt,
    };
  }

  /**
   * 캐시 GC 실행
   * Design Ref: §FR-N254.5 — 캐시 GC 자동화
   */
  runGC(): GCResult {
    const startTime = Date.now();
    const now = Date.now();
    const maxAgeMs = this.gcPolicy.maxAgeDays * 24 * 60 * 60 * 1000;

    let removedLayers = 0;
    let reclaimedBytes = 0;

    // 1. 오래된 레이어 제거
    const beforeCount = this.layers.length;
    this.layers = this.layers.filter(layer => {
      const age = now - new Date(layer.lastAccessedAt).getTime();
      if (age > maxAgeMs) {
        removedLayers++;
        reclaimedBytes += layer.sizeBytes;
        return false;
      }
      return true;
    });

    // 2. 크기 초과 시 LRU 제거
    const totalSize = this.layers.reduce((sum, l) => sum + l.sizeBytes, 0);
    if (totalSize > this.gcPolicy.maxSizeBytes) {
      // 마지막 접근 시간 기준 정렬 (오래된 것 먼저)
      this.layers.sort(
        (a, b) => new Date(a.lastAccessedAt).getTime() - new Date(b.lastAccessedAt).getTime(),
      );

      let currentSize = totalSize;
      while (currentSize > this.gcPolicy.maxSizeBytes && this.layers.length > 0) {
        const removed = this.layers.shift()!;
        currentSize -= removed.sizeBytes;
        removedLayers++;
        reclaimedBytes += removed.sizeBytes;
      }
    }

    this.lastGcAt = new Date().toISOString();
    const remainingSizeBytes = this.layers.reduce((sum, l) => sum + l.sizeBytes, 0);

    return {
      removedLayers,
      reclaimedBytes,
      remainingLayers: this.layers.length,
      remainingSizeBytes,
      durationMs: Date.now() - startTime,
      executedAt: this.lastGcAt,
    };
  }

  /**
   * Dockerfile 최적화 분석
   * Design Ref: §FR-N254.3 — Dockerfile 캐시 최적화 가이드
   */
  analyzeDockerfile(dockerfile: string): DockerfileRecommendation[] {
    const recommendations: DockerfileRecommendation[] = [];
    const lines = dockerfile.split('\n');

    // 규칙 1: COPY 전 패키지 매니저 파일 분리
    const hasCopyAll = lines.some(l => /^COPY\s+\.\s/.test(l.trim()));
    const hasPackageFirst = lines.some(l => /^COPY\s+(package\.json|pnpm-lock)/.test(l.trim()));
    if (hasCopyAll && !hasPackageFirst) {
      recommendations.push({
        ruleId: 'DF-001',
        severity: 'high',
        description: 'COPY . 전에 package.json/pnpm-lock.yaml을 먼저 복사하지 않습니다.',
        recommendation: 'COPY package.json pnpm-lock.yaml ./ 를 먼저 실행 후 RUN pnpm install, 그 다음 COPY . . 순서로 변경',
      });
    }

    // 규칙 2: 멀티스테이지 빌드 미사용
    const hasMultistage = lines.filter(l => /^FROM\s/.test(l.trim())).length > 1;
    if (!hasMultistage) {
      recommendations.push({
        ruleId: 'DF-002',
        severity: 'medium',
        description: '멀티스테이지 빌드를 사용하지 않습니다.',
        recommendation: 'builder 스테이지와 runtime 스테이지를 분리하여 최종 이미지 크기를 줄이십시오.',
      });
    }

    // 규칙 3: apt-get/apk 캐시 미정리
    const hasPackageInstall = lines.some(l => /apt-get install|apk add/.test(l));
    const hasCacheClean = lines.some(l => /rm -rf.*\/var\/cache|--no-cache/.test(l));
    if (hasPackageInstall && !hasCacheClean) {
      recommendations.push({
        ruleId: 'DF-003',
        severity: 'medium',
        description: '패키지 매니저 캐시를 정리하지 않습니다.',
        recommendation: 'apt-get은 && rm -rf /var/lib/apt/lists/*, apk는 --no-cache 플래그 사용',
      });
    }

    // 규칙 4: .dockerignore 미사용 감지 (COPY . 사용 시)
    if (hasCopyAll) {
      recommendations.push({
        ruleId: 'DF-004',
        severity: 'low',
        description: 'COPY . 사용 시 .dockerignore 파일이 필수입니다.',
        recommendation: 'node_modules, .git, dist, *.log 등을 .dockerignore에 추가하십시오.',
      });
    }

    // 규칙 5: 최신 기반 이미지 사용 확인
    const hasLatestTag = lines.some(l => /^FROM\s+\S+:latest/.test(l.trim()));
    if (hasLatestTag) {
      recommendations.push({
        ruleId: 'DF-005',
        severity: 'high',
        description: ':latest 태그를 사용합니다. 빌드 재현성이 보장되지 않습니다.',
        recommendation: '구체적 버전 태그를 사용하십시오 (예: node:22-alpine3.19).',
      });
    }

    // 규칙 6: RUN 명령 병합
    const runCount = lines.filter(l => /^RUN\s/.test(l.trim())).length;
    if (runCount > 5) {
      recommendations.push({
        ruleId: 'DF-006',
        severity: 'low',
        description: `RUN 명령이 ${runCount}개입니다. 레이어 수가 증가합니다.`,
        recommendation: '관련 명령을 && 로 연결하여 레이어 수를 줄이십시오.',
      });
    }

    return recommendations;
  }

  /**
   * 빌드 히스토리 조회
   */
  getBuildHistory(limit: number = 50): BuildResult[] {
    return this.buildHistory.slice(-limit);
  }

  /**
   * 레이어 수 반환
   */
  getLayerCount(): number {
    return this.layers.length;
  }
}
