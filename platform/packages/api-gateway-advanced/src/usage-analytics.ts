// 사용량 분석 (Usage Analytics)
// Design Ref: SVC-APIGW-R22 Plan
// Plan SC: FR-GW.3
// CSAP: D-08 접근 통제, D-10 접근 제어

/**
 * 요청 기록 입력
 */
export interface RequestRecord {
  /** HTTP 메서드 */
  method: string;
  /** 요청 경로 */
  path: string;
  /** HTTP 상태 코드 */
  statusCode: number;
  /** 응답 시간 (밀리초) */
  responseTimeMs: number;
  /** 테넌트 ID (선택) */
  tenantId?: string;
  /** 타임스탬프 (밀리초) */
  timestamp?: number;
}

/**
 * 엔드포인트별 통계
 */
export interface EndpointStats {
  /** HTTP 메서드 */
  method: string;
  /** 요청 경로 */
  path: string;
  /** 총 호출 수 */
  totalRequests: number;
  /** 성공 수 (2xx) */
  successCount: number;
  /** 클라이언트 에러 수 (4xx) */
  clientErrorCount: number;
  /** 서버 에러 수 (5xx) */
  serverErrorCount: number;
  /** 평균 응답 시간 (밀리초) */
  avgResponseTimeMs: number;
  /** 최대 응답 시간 (밀리초) */
  maxResponseTimeMs: number;
  /** P95 응답 시간 (밀리초, 근사치) */
  p95ResponseTimeMs: number;
}

/**
 * 전체 사용량 통계
 */
export interface UsageReport {
  /** 총 요청 수 */
  totalRequests: number;
  /** 총 성공 수 */
  totalSuccess: number;
  /** 총 에러 수 */
  totalErrors: number;
  /** 에러율 (%) */
  errorRate: number;
  /** 평균 응답 시간 */
  avgResponseTimeMs: number;
  /** 엔드포인트별 통계 */
  endpoints: EndpointStats[];
  /** 테넌트별 요청 수 (상위 N개) */
  topTenants: Array<{ tenantId: string; requests: number }>;
  /** 집계 기간 시작 */
  periodStart: string | null;
  /** 집계 기간 종료 */
  periodEnd: string | null;
}

/**
 * 내부 엔드포인트 집계 데이터
 */
interface EndpointAccumulator {
  method: string;
  path: string;
  totalRequests: number;
  successCount: number;
  clientErrorCount: number;
  serverErrorCount: number;
  totalResponseTimeMs: number;
  maxResponseTimeMs: number;
  responseTimes: number[]; // P95 계산용 (샘플링)
}

/**
 * 사용량 분석기 옵션
 */
export interface UsageAnalyticsOptions {
  /** P95 계산용 샘플 최대 수 (기본: 1000) */
  maxSamples?: number;
  /** 상위 테넌트 반환 수 (기본: 10) */
  topTenantsCount?: number;
}

/**
 * API 사용량 분석기
 *
 * 엔드포인트별 호출 통계, 응답 시간 분석, 테넌트별 사용량을 추적합니다.
 */
export class UsageAnalytics {
  private readonly endpoints = new Map<string, EndpointAccumulator>();
  private readonly tenantRequests = new Map<string, number>();
  private readonly maxSamples: number;
  private readonly topTenantsCount: number;

  private totalRequests = 0;
  private firstTimestamp: number | null = null;
  private lastTimestamp: number | null = null;

  constructor(options: UsageAnalyticsOptions = {}) {
    this.maxSamples = options.maxSamples ?? 1000;
    this.topTenantsCount = options.topTenantsCount ?? 10;
  }

  /**
   * 요청 기록
   */
  record(request: RequestRecord): void {
    const now = request.timestamp ?? Date.now();
    this.totalRequests++;

    if (this.firstTimestamp === null) {
      this.firstTimestamp = now;
    }
    this.lastTimestamp = now;

    // 엔드포인트별 집계
    const key = `${request.method.toUpperCase()}:${request.path}`;
    let acc = this.endpoints.get(key);
    if (!acc) {
      acc = {
        method: request.method.toUpperCase(),
        path: request.path,
        totalRequests: 0,
        successCount: 0,
        clientErrorCount: 0,
        serverErrorCount: 0,
        totalResponseTimeMs: 0,
        maxResponseTimeMs: 0,
        responseTimes: [],
      };
      this.endpoints.set(key, acc);
    }

    acc.totalRequests++;
    acc.totalResponseTimeMs += request.responseTimeMs;
    acc.maxResponseTimeMs = Math.max(acc.maxResponseTimeMs, request.responseTimeMs);

    // 상태 코드 분류
    if (request.statusCode >= 200 && request.statusCode < 400) {
      acc.successCount++;
    } else if (request.statusCode >= 400 && request.statusCode < 500) {
      acc.clientErrorCount++;
    } else if (request.statusCode >= 500) {
      acc.serverErrorCount++;
    }

    // P95 샘플 수집 (리저버 샘플링)
    if (acc.responseTimes.length < this.maxSamples) {
      acc.responseTimes.push(request.responseTimeMs);
    } else {
      // 확률적 대체 (리저버 샘플링)
      const idx = Math.floor(Math.random() * acc.totalRequests);
      if (idx < this.maxSamples) {
        acc.responseTimes[idx] = request.responseTimeMs;
      }
    }

    // 테넌트별 집계
    if (request.tenantId) {
      const current = this.tenantRequests.get(request.tenantId) ?? 0;
      this.tenantRequests.set(request.tenantId, current + 1);
    }
  }

  /**
   * 사용량 리포트 생성
   */
  getReport(): UsageReport {
    let totalSuccess = 0;
    let totalErrors = 0;
    let totalResponseTime = 0;

    const endpoints: EndpointStats[] = [];

    for (const acc of this.endpoints.values()) {
      totalSuccess += acc.successCount;
      totalErrors += acc.clientErrorCount + acc.serverErrorCount;
      totalResponseTime += acc.totalResponseTimeMs;

      endpoints.push({
        method: acc.method,
        path: acc.path,
        totalRequests: acc.totalRequests,
        successCount: acc.successCount,
        clientErrorCount: acc.clientErrorCount,
        serverErrorCount: acc.serverErrorCount,
        avgResponseTimeMs: acc.totalRequests > 0
          ? Math.round(acc.totalResponseTimeMs / acc.totalRequests)
          : 0,
        maxResponseTimeMs: acc.maxResponseTimeMs,
        p95ResponseTimeMs: this.calculateP95(acc.responseTimes),
      });
    }

    // 호출 수 기준 내림차순 정렬
    endpoints.sort((a, b) => b.totalRequests - a.totalRequests);

    // 상위 테넌트
    const topTenants = Array.from(this.tenantRequests.entries())
      .map(([tenantId, requests]) => ({ tenantId, requests }))
      .sort((a, b) => b.requests - a.requests)
      .slice(0, this.topTenantsCount);

    return {
      totalRequests: this.totalRequests,
      totalSuccess,
      totalErrors,
      errorRate: this.totalRequests > 0
        ? Math.round((totalErrors / this.totalRequests) * 10000) / 100
        : 0,
      avgResponseTimeMs: this.totalRequests > 0
        ? Math.round(totalResponseTime / this.totalRequests)
        : 0,
      endpoints,
      topTenants,
      periodStart: this.firstTimestamp
        ? new Date(this.firstTimestamp).toISOString()
        : null,
      periodEnd: this.lastTimestamp
        ? new Date(this.lastTimestamp).toISOString()
        : null,
    };
  }

  /**
   * 특정 엔드포인트 통계 조회
   */
  getEndpointStats(method: string, path: string): EndpointStats | undefined {
    const key = `${method.toUpperCase()}:${path}`;
    const acc = this.endpoints.get(key);
    if (!acc) return undefined;

    return {
      method: acc.method,
      path: acc.path,
      totalRequests: acc.totalRequests,
      successCount: acc.successCount,
      clientErrorCount: acc.clientErrorCount,
      serverErrorCount: acc.serverErrorCount,
      avgResponseTimeMs: acc.totalRequests > 0
        ? Math.round(acc.totalResponseTimeMs / acc.totalRequests)
        : 0,
      maxResponseTimeMs: acc.maxResponseTimeMs,
      p95ResponseTimeMs: this.calculateP95(acc.responseTimes),
    };
  }

  /**
   * 전체 통계 리셋
   */
  reset(): void {
    this.endpoints.clear();
    this.tenantRequests.clear();
    this.totalRequests = 0;
    this.firstTimestamp = null;
    this.lastTimestamp = null;
  }

  /**
   * P95 계산 (근사치)
   */
  private calculateP95(samples: number[]): number {
    if (samples.length === 0) return 0;
    const sorted = [...samples].sort((a, b) => a - b);
    const idx = Math.ceil(sorted.length * 0.95) - 1;
    return sorted[Math.max(0, idx)]!;
  }
}
