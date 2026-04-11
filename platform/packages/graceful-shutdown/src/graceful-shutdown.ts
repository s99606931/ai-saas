// Graceful Shutdown -- 서비스 무중단 종료
// Design Ref: SVC-GRACEFUL-R26 DESIGN
// Plan SC: FR-GS.1, FR-GS.2, FR-GS.3, FR-GS.4, FR-GS.5, FR-GS.6
// CSAP: D-14 시스템 가용성

/**
 * Graceful Shutdown 옵션
 */
export interface GracefulShutdownOptions {
  /** 강제 종료 타임아웃 (밀리초, 기본: 30000) */
  forceTimeoutMs?: number;
  /** 헬스체크 실패 후 드레인 대기 (밀리초, 기본: 5000) */
  drainDelayMs?: number;
  /** 셧다운 시작 시 콜백 (로깅용) */
  onShutdown?: () => void;
  /** process.exit 호출 여부 (테스트 시 false, 기본: true) */
  exitProcess?: boolean;
}

/**
 * 셧다운 콜백 (리소스 정리용)
 */
export type ShutdownCallback = () => Promise<void> | void;

/**
 * Graceful Shutdown 관리자
 *
 * 서비스 종료 시 다음 순서로 처리합니다:
 * 1. SIGTERM/SIGINT 수신 -> isShuttingDown = true
 * 2. 헬스체크가 503 반환 시작 (k8s가 라우팅 중단)
 * 3. drainDelay 대기 (k8s 라우팅 전환 시간)
 * 4. 진행 중 요청 완료 대기 (inflightCount === 0)
 * 5. 셧다운 콜백 실행 (역순: LIFO)
 * 6. process.exit(0)
 *
 * forceTimeout 초과 시 강제 종료 (exit 1)
 *
 * CSAP D-14: 시스템 가용성 보장
 */
export class GracefulShutdown {
  private shutdownCallbacks: ShutdownCallback[] = [];
  private inflightCount = 0;
  private shuttingDown = false;
  private readonly forceTimeoutMs: number;
  private readonly drainDelayMs: number;
  private readonly onShutdown?: () => void;
  private readonly exitProcess: boolean;
  private forceTimer: ReturnType<typeof setTimeout> | null = null;
  private shutdownPromise: Promise<void> | null = null;
  private shutdownResolve: (() => void) | null = null;

  constructor(options: GracefulShutdownOptions = {}) {
    this.forceTimeoutMs = options.forceTimeoutMs ?? 30_000;
    this.drainDelayMs = options.drainDelayMs ?? 5000;
    this.onShutdown = options.onShutdown;
    this.exitProcess = options.exitProcess !== false;
  }

  /**
   * 시그널 핸들러 등록
   * Plan SC: FR-GS.1
   */
  registerSignalHandlers(): void {
    const handler = () => { void this.shutdown(); };
    process.on('SIGTERM', handler);
    process.on('SIGINT', handler);
  }

  /**
   * 셧다운 콜백 등록 (LIFO 순서로 실행)
   * Plan SC: FR-GS.5
   */
  addCallback(callback: ShutdownCallback): void {
    this.shutdownCallbacks.push(callback);
  }

  /**
   * 진행 중 요청 시작 (카운터 증가)
   * Plan SC: FR-GS.2
   */
  trackRequest(): void {
    this.inflightCount++;
  }

  /**
   * 진행 중 요청 완료 (카운터 감소)
   * Plan SC: FR-GS.2
   */
  untrackRequest(): void {
    if (this.inflightCount > 0) {
      this.inflightCount--;
    }
  }

  /**
   * 현재 진행 중 요청 수
   */
  getInflightCount(): number {
    return this.inflightCount;
  }

  /**
   * 셧다운 진행 중 여부
   * Plan SC: FR-GS.6
   */
  isShuttingDown(): boolean {
    return this.shuttingDown;
  }

  /**
   * 셧다운 실행
   * Plan SC: FR-GS.3, FR-GS.4
   */
  async shutdown(): Promise<void> {
    // 중복 호출 방지
    if (this.shuttingDown) {
      return this.shutdownPromise ?? Promise.resolve();
    }

    this.shuttingDown = true;
    this.shutdownPromise = new Promise<void>((resolve) => {
      this.shutdownResolve = resolve;
    });

    if (this.onShutdown) {
      this.onShutdown();
    }

    // 강제 종료 타이머
    this.forceTimer = setTimeout(() => {
      if (this.exitProcess) {
        process.exit(1);
      }
      this.shutdownResolve?.();
    }, this.forceTimeoutMs);

    try {
      // 1. 드레인 대기 (k8s 라우팅 전환)
      if (this.drainDelayMs > 0) {
        await this.delay(this.drainDelayMs);
      }

      // 2. 진행 중 요청 완료 대기
      await this.waitForInflightRequests();

      // 3. 셧다운 콜백 실행 (역순 LIFO)
      const reversedCallbacks = [...this.shutdownCallbacks].reverse();
      for (const callback of reversedCallbacks) {
        try {
          await callback();
        } catch {
          // 콜백 실패는 무시 (최선 노력)
        }
      }

      // 4. 정상 종료
      if (this.forceTimer) {
        clearTimeout(this.forceTimer);
      }

      if (this.exitProcess) {
        process.exit(0);
      }
    } finally {
      this.shutdownResolve?.();
    }
  }

  /**
   * 리소스 정리 (테스트용)
   */
  destroy(): void {
    if (this.forceTimer) {
      clearTimeout(this.forceTimer);
      this.forceTimer = null;
    }
    this.shutdownCallbacks = [];
    this.inflightCount = 0;
    this.shuttingDown = false;
  }

  // ── 내부 메서드 ─────────────────────────────────────────

  private async waitForInflightRequests(): Promise<void> {
    const checkInterval = 100; // 100ms마다 확인
    while (this.inflightCount > 0) {
      await this.delay(checkInterval);
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
