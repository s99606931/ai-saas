// 다중 서비스 헬스체크 집계기
// Design Ref: SVC-HEALTHAGG-R23 Plan
// Plan SC: FR-HA.1, FR-HA.2, FR-HA.3, FR-HA.4, FR-HA.5
// CSAP: D-14 운영 관리

/**
 * 서비스 상태
 */
export type HealthStatus = 'healthy' | 'degraded' | 'unhealthy';

/**
 * 헬스체크 함수 타입
 */
export type HealthChecker = () => Promise<HealthCheckResult>;

/**
 * 개별 헬스체크 결과
 */
export interface HealthCheckResult {
  /** 상태 */
  status: HealthStatus;
  /** 응답 시간 (밀리초) */
  responseTimeMs: number;
  /** 추가 상세 정보 */
  details?: Record<string, unknown>;
  /** 에러 메시지 (unhealthy 시) */
  error?: string;
}

/**
 * 서비스 정의
 */
export interface ServiceDefinition {
  /** 서비스 이름 */
  name: string;
  /** 헬스체크 함수 */
  checker: HealthChecker;
  /** 필수 서비스 여부 (true: 이 서비스 down → 전체 unhealthy) */
  critical?: boolean;
  /** 타임아웃 (밀리초, 기본: 5000) */
  timeoutMs?: number;
  /** 태그 (분류용) */
  tags?: string[];
}

/**
 * 서비스 상태 (이력 포함)
 */
export interface ServiceStatus {
  /** 서비스 이름 */
  name: string;
  /** 현재 상태 */
  status: HealthStatus;
  /** 마지막 체크 시각 */
  lastCheckedAt: string;
  /** 응답 시간 (밀리초) */
  responseTimeMs: number;
  /** 연속 실패 횟수 */
  consecutiveFailures: number;
  /** 필수 서비스 여부 */
  critical: boolean;
  /** 태그 */
  tags: string[];
  /** 에러 메시지 */
  error: string | null;
  /** 최근 체크 이력 */
  history: HealthHistoryEntry[];
}

/**
 * 이력 엔트리
 */
export interface HealthHistoryEntry {
  status: HealthStatus;
  responseTimeMs: number;
  timestamp: string;
  error: string | null;
}

/**
 * 집계 결과
 */
export interface AggregateHealthResult {
  /** 종합 상태 */
  status: HealthStatus;
  /** 서비스별 상태 */
  services: ServiceStatus[];
  /** 정상 서비스 수 */
  healthyCount: number;
  /** 비정상 서비스 수 */
  unhealthyCount: number;
  /** 성능 저하 서비스 수 */
  degradedCount: number;
  /** 총 서비스 수 */
  totalCount: number;
  /** 체크 소요 시간 (밀리초) */
  checkDurationMs: number;
  /** 체크 시각 */
  checkedAt: string;
}

/**
 * 집계기 옵션
 */
export interface HealthAggregatorOptions {
  /** 이력 최대 보존 수 (기본: 10) */
  maxHistorySize?: number;
  /** 기본 타임아웃 (밀리초, 기본: 5000) */
  defaultTimeoutMs?: number;
  /** degraded 판정 응답 시간 임계값 (밀리초, 기본: 3000) */
  degradedThresholdMs?: number;
}

/**
 * 다중 서비스 헬스체크 집계기
 *
 * 등록된 모든 서비스의 상태를 동시에 확인하고
 * 종합 판정을 반환합니다.
 *
 * 판정 규칙:
 * - 모든 서비스 healthy → 종합 healthy
 * - critical 서비스 unhealthy → 종합 unhealthy
 * - non-critical 서비스 unhealthy → 종합 degraded
 * - 응답 느림 (degradedThresholdMs 초과) → 해당 서비스 degraded
 */
export class HealthAggregator {
  private readonly services = new Map<string, ServiceDefinition>();
  private readonly statuses = new Map<string, ServiceStatus>();
  private readonly maxHistorySize: number;
  private readonly defaultTimeoutMs: number;
  private readonly degradedThresholdMs: number;

  constructor(options: HealthAggregatorOptions = {}) {
    this.maxHistorySize = options.maxHistorySize ?? 10;
    this.defaultTimeoutMs = options.defaultTimeoutMs ?? 5000;
    this.degradedThresholdMs = options.degradedThresholdMs ?? 3000;
  }

  /**
   * 서비스 등록
   */
  register(definition: ServiceDefinition): void {
    this.services.set(definition.name, definition);
    this.statuses.set(definition.name, {
      name: definition.name,
      status: 'healthy',
      lastCheckedAt: '',
      responseTimeMs: 0,
      consecutiveFailures: 0,
      critical: definition.critical ?? false,
      tags: definition.tags ?? [],
      error: null,
      history: [],
    });
  }

  /**
   * 서비스 등록 해제
   */
  unregister(name: string): boolean {
    this.statuses.delete(name);
    return this.services.delete(name);
  }

  /**
   * 등록된 서비스 목록
   */
  getRegisteredServices(): string[] {
    return Array.from(this.services.keys());
  }

  /**
   * 개별 서비스 상태 확인
   */
  async checkService(name: string): Promise<ServiceStatus | undefined> {
    const definition = this.services.get(name);
    if (!definition) return undefined;

    const status = this.statuses.get(name)!;
    const timeoutMs = definition.timeoutMs ?? this.defaultTimeoutMs;

    const startTime = Date.now();
    try {
      const result = await this.executeWithTimeout(definition.checker, timeoutMs);
      const responseTimeMs = Date.now() - startTime;

      // 응답 느림 시 degraded로 승격
      let effectiveStatus = result.status;
      if (effectiveStatus === 'healthy' && responseTimeMs > this.degradedThresholdMs) {
        effectiveStatus = 'degraded';
      }

      status.status = effectiveStatus;
      status.responseTimeMs = responseTimeMs;
      status.lastCheckedAt = new Date().toISOString();
      status.error = result.error ?? null;
      status.consecutiveFailures = effectiveStatus === 'unhealthy'
        ? status.consecutiveFailures + 1
        : 0;

      this.addHistory(status, {
        status: effectiveStatus,
        responseTimeMs,
        timestamp: status.lastCheckedAt,
        error: result.error ?? null,
      });
    } catch (err) {
      const responseTimeMs = Date.now() - startTime;
      const errorMessage = err instanceof Error ? err.message : String(err);

      status.status = 'unhealthy';
      status.responseTimeMs = responseTimeMs;
      status.lastCheckedAt = new Date().toISOString();
      status.error = errorMessage;
      status.consecutiveFailures++;

      this.addHistory(status, {
        status: 'unhealthy',
        responseTimeMs,
        timestamp: status.lastCheckedAt,
        error: errorMessage,
      });
    }

    return { ...status, history: [...status.history] };
  }

  /**
   * 전체 서비스 집계 상태 확인
   */
  async checkAll(): Promise<AggregateHealthResult> {
    const startTime = Date.now();
    const names = Array.from(this.services.keys());

    // 병렬 체크
    await Promise.all(names.map((name) => this.checkService(name)));

    let healthyCount = 0;
    let unhealthyCount = 0;
    let degradedCount = 0;
    let hasCriticalFailure = false;
    let hasAnyFailure = false;

    const services: ServiceStatus[] = [];

    for (const name of names) {
      const status = this.statuses.get(name)!;
      services.push({ ...status, history: [...status.history] });

      if (status.status === 'healthy') {
        healthyCount++;
      } else if (status.status === 'unhealthy') {
        unhealthyCount++;
        hasAnyFailure = true;
        if (status.critical) {
          hasCriticalFailure = true;
        }
      } else {
        degradedCount++;
        hasAnyFailure = true;
      }
    }

    // 종합 판정
    let overallStatus: HealthStatus;
    if (hasCriticalFailure) {
      overallStatus = 'unhealthy';
    } else if (hasAnyFailure) {
      overallStatus = 'degraded';
    } else {
      overallStatus = 'healthy';
    }

    return {
      status: overallStatus,
      services,
      healthyCount,
      unhealthyCount,
      degradedCount,
      totalCount: names.length,
      checkDurationMs: Date.now() - startTime,
      checkedAt: new Date().toISOString(),
    };
  }

  /**
   * 특정 서비스의 최근 상태 (체크 실행 없이)
   */
  getServiceStatus(name: string): ServiceStatus | undefined {
    const status = this.statuses.get(name);
    return status ? { ...status, history: [...status.history] } : undefined;
  }

  // ── 내부 메서드 ─────────────────────────────────────────

  private async executeWithTimeout(
    checker: HealthChecker,
    timeoutMs: number,
  ): Promise<HealthCheckResult> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`헬스체크 타임아웃: ${timeoutMs}ms 초과`));
      }, timeoutMs);

      checker()
        .then((result) => {
          clearTimeout(timer);
          resolve(result);
        })
        .catch((err) => {
          clearTimeout(timer);
          reject(err);
        });
    });
  }

  private addHistory(status: ServiceStatus, entry: HealthHistoryEntry): void {
    status.history.push(entry);
    if (status.history.length > this.maxHistorySize) {
      status.history.shift();
    }
  }
}
