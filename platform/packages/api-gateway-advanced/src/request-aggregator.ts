// 요청 집계기 (Request Aggregator)
// Design Ref: SVC-APIGW-R22 Plan
// Plan SC: FR-GW.4
// CSAP: D-12 시스템 개발 보안

/**
 * 집계 대상 정의
 */
export interface AggregationTarget {
  /** 대상 식별자 (응답에서 사용할 키) */
  key: string;
  /** 요청 실행 함수 */
  execute: () => Promise<unknown>;
  /** 개별 타임아웃 (밀리초, 0 = 전체 타임아웃 따름) */
  timeoutMs?: number;
  /** 실패 시 기본값 (선택) */
  fallback?: unknown;
  /** 필수 여부 (true: 실패 시 전체 실패, false: fallback 사용) */
  required?: boolean;
}

/**
 * 집계 결과
 */
export interface AggregationResult {
  /** 성공 여부 */
  success: boolean;
  /** 집계된 데이터 (key → value) */
  data: Record<string, unknown>;
  /** 실패한 대상 목록 */
  errors: Array<{
    key: string;
    error: string;
  }>;
  /** 총 소요 시간 (밀리초) */
  totalDurationMs: number;
  /** 대상별 소요 시간 */
  durations: Record<string, number>;
}

/**
 * 집계기 옵션
 */
export interface RequestAggregatorOptions {
  /** 전체 타임아웃 (밀리초, 기본: 10000) */
  globalTimeoutMs?: number;
  /** 부분 실패 허용 여부 (기본: true) */
  allowPartialFailure?: boolean;
}

/**
 * 요청 집계기
 *
 * 여러 백엔드 서비스에 대한 요청을 병렬로 실행하고
 * 결과를 하나의 응답으로 병합합니다.
 *
 * 활용 예:
 * - 대시보드: 사용자 정보 + 테넌트 정보 + 구독 정보 동시 조회
 * - BFF 패턴: 모바일 화면에 필요한 여러 서비스 데이터 한 번에 조회
 */
export class RequestAggregator {
  private readonly globalTimeoutMs: number;
  private readonly allowPartialFailure: boolean;

  constructor(options: RequestAggregatorOptions = {}) {
    this.globalTimeoutMs = options.globalTimeoutMs ?? 10_000;
    this.allowPartialFailure = options.allowPartialFailure ?? true;
  }

  /**
   * 여러 대상을 병렬로 실행하고 결과 병합
   *
   * @param targets 집계 대상 목록
   * @returns 집계 결과
   */
  async aggregate(targets: AggregationTarget[]): Promise<AggregationResult> {
    if (targets.length === 0) {
      return {
        success: true,
        data: {},
        errors: [],
        totalDurationMs: 0,
        durations: {},
      };
    }

    const startTime = Date.now();
    const data: Record<string, unknown> = {};
    const errors: Array<{ key: string; error: string }> = [];
    const durations: Record<string, number> = {};

    // 병렬 실행
    const promises = targets.map(async (target) => {
      const targetStart = Date.now();
      const timeout = target.timeoutMs ?? this.globalTimeoutMs;

      try {
        const result = await this.executeWithTimeout(target.execute, timeout);
        durations[target.key] = Date.now() - targetStart;
        data[target.key] = result;
      } catch (err) {
        durations[target.key] = Date.now() - targetStart;
        const errorMessage = err instanceof Error ? err.message : String(err);
        errors.push({ key: target.key, error: errorMessage });

        if (target.required !== false && !this.allowPartialFailure) {
          // 필수 대상 실패 + 부분 실패 불허용 → 예외 전파
          throw err;
        }

        // fallback 적용
        if (target.fallback !== undefined) {
          data[target.key] = target.fallback;
        }
      }
    });

    try {
      await Promise.all(promises);
    } catch {
      // 필수 대상 실패 시 여기로 옴
    }

    const totalDurationMs = Date.now() - startTime;
    const hasRequiredFailure = errors.some((e) => {
      const target = targets.find((t) => t.key === e.key);
      return target?.required !== false;
    });

    return {
      success: !hasRequiredFailure || this.allowPartialFailure,
      data,
      errors,
      totalDurationMs,
      durations,
    };
  }

  /**
   * 타임아웃 포함 실행
   */
  private async executeWithTimeout(
    fn: () => Promise<unknown>,
    timeoutMs: number,
  ): Promise<unknown> {
    if (timeoutMs <= 0) {
      return fn();
    }

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`집계 요청 타임아웃: ${timeoutMs}ms 초과`));
      }, timeoutMs);

      fn()
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
}
