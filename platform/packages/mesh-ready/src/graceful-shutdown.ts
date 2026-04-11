// SIGTERM 그레이스풀 셧다운 표준화
// Design Ref: SVC-MESH-R13 Plan
// Plan SC: FR-MESH.3
// CSAP: D-07 가용성 관리

import type { FastifyInstance } from 'fastify';

/**
 * 그레이스풀 셧다운 옵션
 */
export interface GracefulShutdownOptions {
  /** 셧다운 대기 최대 시간 (ms). 기본: 30000 */
  timeout?: number;
  /** 셧다운 시작 시 호출할 정리 함수 목록 */
  cleanupHandlers?: Array<() => Promise<void>>;
  /** 로거 */
  logger?: { info: (msg: string) => void; error: (msg: string) => void };
}

/** 기본 셧다운 타임아웃 (30초 — k8s terminationGracePeriodSeconds 기본값과 일치) */
const DEFAULT_TIMEOUT = 30_000;

/**
 * 그레이스풀 셧다운 관리자
 *
 * SIGTERM 수신 시:
 * 1. readiness = false (신규 요청 거부)
 * 2. 진행 중 요청 완료 대기
 * 3. 정리 핸들러 실행 (DB 연결, 캐시 등)
 * 4. 로그 flush 후 프로세스 종료
 */
export class GracefulShutdown {
  private readonly timeout: number;
  private readonly cleanupHandlers: Array<() => Promise<void>>;
  private readonly logger: { info: (msg: string) => void; error: (msg: string) => void };
  private isShuttingDown = false;
  private activeRequests = 0;

  constructor(options: GracefulShutdownOptions = {}) {
    this.timeout = options.timeout ?? DEFAULT_TIMEOUT;
    this.cleanupHandlers = options.cleanupHandlers ?? [];
    this.logger = options.logger ?? {
      // NOTE: 폴백 로거. 프로덕션에서는 반드시 구조화된 로거를 주입하세요.
      // Design Ref: SVC-MESH-R13 — NFR-2 운영 가시성
      info: (msg: string) => {
        process.stdout.write(JSON.stringify({ level: 'info', component: 'graceful-shutdown', msg, ts: new Date().toISOString() }) + '\n');
      },
      error: (msg: string) => {
        process.stderr.write(JSON.stringify({ level: 'error', component: 'graceful-shutdown', msg, ts: new Date().toISOString() }) + '\n');
      },
    };
  }

  /**
   * 셧다운 진행 여부 반환 (readiness 프로브용)
   */
  isTerminating(): boolean {
    return this.isShuttingDown;
  }

  /**
   * 현재 활성 요청 수 반환
   */
  getActiveRequests(): number {
    return this.activeRequests;
  }

  /**
   * 활성 요청 카운터 증가 (onRequest 훅)
   */
  incrementRequests(): void {
    this.activeRequests++;
  }

  /**
   * 활성 요청 카운터 감소 (onResponse 훅)
   */
  decrementRequests(): void {
    if (this.activeRequests > 0) {
      this.activeRequests--;
    }
  }

  /**
   * 정리 핸들러 등록
   */
  addCleanupHandler(handler: () => Promise<void>): void {
    this.cleanupHandlers.push(handler);
  }

  /**
   * 그레이스풀 셧다운 시작
   *
   * Fastify 인스턴스와 연동하여 순차적으로 종료합니다.
   */
  async shutdown(app?: FastifyInstance): Promise<void> {
    if (this.isShuttingDown) {
      this.logger.info('이미 셧다운 진행 중');
      return;
    }

    this.isShuttingDown = true;
    this.logger.info(`그레이스풀 셧다운 시작 (timeout: ${this.timeout}ms)`);

    // 1단계: 진행 중 요청 완료 대기
    await this.waitForActiveRequests();

    // 2단계: 정리 핸들러 실행
    await this.runCleanupHandlers();

    // 3단계: Fastify 서버 종료
    if (app) {
      try {
        await app.close();
        this.logger.info('Fastify 서버 종료 완료');
      } catch (err) {
        this.logger.error(`Fastify 종료 실패: ${String(err)}`);
      }
    }

    this.logger.info('그레이스풀 셧다운 완료');
  }

  /**
   * Fastify 인스턴스에 셧다운 훅 등록
   */
  registerWithFastify(app: FastifyInstance): void {
    // onRequest: 활성 요청 카운터 증가 + 셧다운 중 요청 거부
    app.addHook('onRequest', async (_request, reply) => {
      if (this.isShuttingDown) {
        reply.status(503).send({
          error: 'Service Unavailable',
          message: '서비스가 종료 중입니다',
          code: 'SERVICE_SHUTTING_DOWN',
        });
        return;
      }
      this.incrementRequests();
    });

    // onResponse: 활성 요청 카운터 감소
    app.addHook('onResponse', async () => {
      this.decrementRequests();
    });

    // SIGTERM 핸들러 등록 — unhandled rejection 방지 (.catch 필수)
    const handler = () => {
      this.shutdown(app).then(() => {
        process.exit(0);
      }).catch((err) => {
        this.logger.error(`셧다운 중 오류 발생: ${String(err)}`);
        process.exit(1);
      });
    };

    process.on('SIGTERM', handler);
    process.on('SIGINT', handler);
  }

  /**
   * 활성 요청 완료 대기 (타임아웃 포함)
   */
  private async waitForActiveRequests(): Promise<void> {
    if (this.activeRequests === 0) {
      this.logger.info('활성 요청 없음, 즉시 진행');
      return;
    }

    this.logger.info(`활성 요청 ${this.activeRequests}개 완료 대기 중...`);

    return new Promise<void>((resolve) => {
      const startTime = Date.now();
      const interval = setInterval(() => {
        if (this.activeRequests === 0) {
          clearInterval(interval);
          this.logger.info('모든 활성 요청 완료');
          resolve();
          return;
        }

        if (Date.now() - startTime >= this.timeout) {
          clearInterval(interval);
          this.logger.error(
            `타임아웃: 활성 요청 ${this.activeRequests}개가 ${this.timeout}ms 내 완료되지 않음`,
          );
          resolve();
          return;
        }
      }, 100);
    });
  }

  /**
   * 정리 핸들러 순차 실행
   */
  private async runCleanupHandlers(): Promise<void> {
    for (let i = 0; i < this.cleanupHandlers.length; i++) {
      const handler = this.cleanupHandlers[i];
      if (!handler) continue;
      try {
        await handler();
        this.logger.info(`정리 핸들러 ${i + 1}/${this.cleanupHandlers.length} 완료`);
      } catch (err) {
        this.logger.error(`정리 핸들러 ${i + 1} 실패: ${String(err)}`);
      }
    }
  }
}
