// 서비스 헬스체크 엔진
// Design Ref: SVC-HEALTH-R10 Plan
// Plan SC: FR-HEALTH.1, FR-HEALTH.3, FR-HEALTH.4
// CSAP: D-07 가용성

/**
 * 개별 의존성 체크 결과
 */
export interface DependencyStatus {
  name: string;
  status: 'healthy' | 'degraded' | 'unhealthy';
  responseTimeMs: number;
  message?: string;
  lastChecked: string;
}

/**
 * 전체 서비스 상태
 */
export interface HealthStatus {
  service: string;
  status: 'healthy' | 'degraded' | 'unhealthy';
  version: string;
  uptime: number;
  timestamp: string;
  dependencies: DependencyStatus[];
}

/**
 * 의존성 체커 인터페이스
 */
export interface DependencyChecker {
  name: string;
  check: () => Promise<{ healthy: boolean; message?: string }>;
  /** 타임아웃 (ms) */
  timeout?: number;
}

/**
 * SLA 계산 결과
 */
export interface SLAMetrics {
  uptimePercentage: number;
  totalChecks: number;
  healthyChecks: number;
  degradedChecks: number;
  unhealthyChecks: number;
  averageResponseTimeMs: number;
}

/**
 * 헬스체크 엔진
 *
 * CSAP D-07 가용성 요건:
 * - 서비스 상태 실시간 모니터링
 * - 의존성(DB, Redis, 외부 서비스) 상태 확인
 * - SLA 메트릭 수집 및 계산
 */
export class HealthChecker {
  private readonly serviceName: string;
  private readonly version: string;
  private readonly startTime: number;
  private readonly checkers: DependencyChecker[] = [];
  private readonly history: Array<{ timestamp: number; status: string }> = [];
  private readonly maxHistory: number;

  constructor(serviceName: string, version: string = '0.1.0', maxHistory: number = 1000) {
    this.serviceName = serviceName;
    this.version = version;
    this.startTime = Date.now();
    this.maxHistory = maxHistory;
  }

  /**
   * 의존성 체커 등록
   */
  addChecker(checker: DependencyChecker): void {
    this.checkers.push(checker);
  }

  /**
   * 전체 헬스체크 실행
   */
  async check(): Promise<HealthStatus> {
    const dependencies = await Promise.all(
      this.checkers.map((checker) => this.runChecker(checker)),
    );

    const hasUnhealthy = dependencies.some((d) => d.status === 'unhealthy');
    const hasDegraded = dependencies.some((d) => d.status === 'degraded');

    const status: HealthStatus['status'] = hasUnhealthy
      ? 'unhealthy'
      : hasDegraded
        ? 'degraded'
        : 'healthy';

    // 이력 기록
    this.history.push({ timestamp: Date.now(), status });
    if (this.history.length > this.maxHistory) {
      this.history.splice(0, this.history.length - this.maxHistory);
    }

    return {
      service: this.serviceName,
      status,
      version: this.version,
      uptime: Math.floor((Date.now() - this.startTime) / 1000),
      timestamp: new Date().toISOString(),
      dependencies,
    };
  }

  /**
   * 라이브니스 체크 (서비스 자체 상태)
   * Kubernetes livenessProbe 용
   */
  liveness(): { status: 'ok'; uptime: number } {
    return {
      status: 'ok',
      uptime: Math.floor((Date.now() - this.startTime) / 1000),
    };
  }

  /**
   * 레디니스 체크 (트래픽 수신 가능 여부)
   * Kubernetes readinessProbe 용
   */
  async readiness(): Promise<{ ready: boolean; dependencies: DependencyStatus[] }> {
    const dependencies = await Promise.all(
      this.checkers.map((checker) => this.runChecker(checker)),
    );
    const ready = dependencies.every((d) => d.status !== 'unhealthy');
    return { ready, dependencies };
  }

  /**
   * SLA 메트릭 계산
   */
  calculateSLA(): SLAMetrics {
    const total = this.history.length;
    if (total === 0) {
      return {
        uptimePercentage: 100,
        totalChecks: 0,
        healthyChecks: 0,
        degradedChecks: 0,
        unhealthyChecks: 0,
        averageResponseTimeMs: 0,
      };
    }

    const healthy = this.history.filter((h) => h.status === 'healthy').length;
    const degraded = this.history.filter((h) => h.status === 'degraded').length;
    const unhealthy = this.history.filter((h) => h.status === 'unhealthy').length;

    return {
      uptimePercentage: ((healthy + degraded) / total) * 100,
      totalChecks: total,
      healthyChecks: healthy,
      degradedChecks: degraded,
      unhealthyChecks: unhealthy,
      averageResponseTimeMs: 0, // 실제 구현 시 체커 응답 시간 기록
    };
  }

  /**
   * 개별 체커 실행 (타임아웃 포함)
   */
  private async runChecker(checker: DependencyChecker): Promise<DependencyStatus> {
    const timeout = checker.timeout ?? 5000;
    const start = Date.now();

    try {
      const result = await Promise.race([
        checker.check(),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('Timeout')), timeout),
        ),
      ]);

      const responseTimeMs = Date.now() - start;

      return {
        name: checker.name,
        status: result.healthy
          ? responseTimeMs > timeout * 0.8
            ? 'degraded'
            : 'healthy'
          : 'unhealthy',
        responseTimeMs,
        message: result.message,
        lastChecked: new Date().toISOString(),
      };
    } catch (error) {
      return {
        name: checker.name,
        status: 'unhealthy',
        responseTimeMs: Date.now() - start,
        message: error instanceof Error ? error.message : 'Unknown error',
        lastChecked: new Date().toISOString(),
      };
    }
  }
}

/**
 * 공통 의존성 체커 팩토리
 */
export const CommonCheckers = {
  /**
   * 데이터베이스 연결 체커 (Prisma 호환)
   */
  database(prisma: { $queryRaw: (sql: unknown) => Promise<unknown> }): DependencyChecker {
    return {
      name: 'database',
      timeout: 3000,
      check: async () => {
        try {
          await prisma.$queryRaw`SELECT 1`;
          return { healthy: true };
        } catch (e) {
          return { healthy: false, message: (e as Error).message };
        }
      },
    };
  },

  /**
   * HTTP 서비스 연결 체커
   */
  httpService(name: string, url: string): DependencyChecker {
    return {
      name,
      timeout: 5000,
      check: async () => {
        try {
          const res = await fetch(url, { signal: AbortSignal.timeout(4000) });
          return { healthy: res.ok, message: `HTTP ${res.status}` };
        } catch (e) {
          return { healthy: false, message: (e as Error).message };
        }
      },
    };
  },

  /**
   * 커스텀 체커 (간편 생성)
   */
  custom(
    name: string,
    fn: () => Promise<boolean>,
    timeout?: number,
  ): DependencyChecker {
    return {
      name,
      timeout,
      check: async () => {
        const healthy = await fn();
        return { healthy };
      },
    };
  },
};
