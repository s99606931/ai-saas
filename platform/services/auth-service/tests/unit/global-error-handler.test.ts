// 전역 에러 핸들러 테스트 -- Cycle 7
// Design Ref: CSAP D-07 운영 안정성
// Plan SC: FR-OTEL.3

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('전역 에러 핸들러 패턴 검증 (CSAP D-07)', () => {
  let originalListeners: NodeJS.UncaughtExceptionListener[];
  let originalRejectionListeners: NodeJS.UnhandledRejectionListener[];

  beforeEach(() => {
    originalListeners = process.listeners('uncaughtException') as NodeJS.UncaughtExceptionListener[];
    originalRejectionListeners = process.listeners('unhandledRejection') as NodeJS.UnhandledRejectionListener[];
  });

  afterEach(() => {
    process.removeAllListeners('uncaughtException');
    process.removeAllListeners('unhandledRejection');
    for (const listener of originalListeners) {
      process.on('uncaughtException', listener);
    }
    for (const listener of originalRejectionListeners) {
      process.on('unhandledRejection', listener);
    }
  });

  it('uncaughtException 핸들러가 등록 가능하고 호출된다', () => {
    const handler = vi.fn();
    process.on('uncaughtException', handler);

    const error = new Error('테스트 예외');
    process.emit('uncaughtException', error, 'uncaughtException');

    expect(handler).toHaveBeenCalledWith(error, 'uncaughtException');
  });

  it('unhandledRejection 핸들러가 등록 가능하고 호출된다', () => {
    const handler = vi.fn();
    process.on('unhandledRejection', handler);

    const reason = new Error('거부된 Promise');
    const promise = Promise.reject(reason);
    promise.catch(() => {}); // suppress unhandled rejection warning

    process.emit('unhandledRejection', reason, promise);

    expect(handler).toHaveBeenCalledWith(reason, promise);
  });

  it('shutdown 함수 패턴: 에러 발생 시 graceful shutdown 트리거', async () => {
    const shutdownCalled = vi.fn();

    const shutdown = async (signal: string): Promise<void> => {
      shutdownCalled(signal);
    };

    process.on('uncaughtException', () => {
      void shutdown('uncaughtException');
    });

    const error = new Error('치명적 에러');
    process.emit('uncaughtException', error, 'uncaughtException');

    expect(shutdownCalled).toHaveBeenCalledWith('uncaughtException');
  });

  it('에러 로깅 패턴: 에러 정보가 구조화된 로그로 기록된다', () => {
    const logEntries: Array<{ level: string; error?: unknown; reason?: unknown; message: string }> = [];

    const logger = {
      fatal: (data: Record<string, unknown>, msg: string) => {
        logEntries.push({ level: 'fatal', error: data['err'], message: msg });
      },
      error: (data: Record<string, unknown>, msg: string) => {
        logEntries.push({ level: 'error', reason: data['reason'], message: msg });
      },
    };

    // uncaughtException 로깅
    const testError = new Error('테스트');
    logger.fatal({ err: testError }, '치명적 예외 발생 — 서비스 종료');

    expect(logEntries[0].level).toBe('fatal');
    expect(logEntries[0].error).toBe(testError);

    // unhandledRejection 로깅
    const reason = 'Promise 거부 사유';
    logger.error({ reason }, '처리되지 않은 Promise rejection');

    expect(logEntries[1].level).toBe('error');
    expect(logEntries[1].reason).toBe(reason);
  });

  it('17개 서비스 index.ts에 에러 핸들러 패턴 존재 여부 검증', async () => {
    const { readFileSync } = await import('fs');
    const { resolve } = await import('path');

    const services = [
      'ai-service',
      'api-gateway',
      'audit-service',
      'auth-service',
      'billing-service',
      'catalog-service',
      'compliance-service',
      'crm-service',
      'file-service',
      'menu-service',
      'notification-service',
      'saas-catalog-service',
      'security-monitor-service',
      'security-service',
      'subscription-service',
      'tenant-service',
      'user-service',
    ];

    for (const svc of services) {
      const indexPath = resolve('/data/ai-saas/platform/services', svc, 'src/index.ts');
      const content = readFileSync(indexPath, 'utf-8');

      expect(content, `${svc}: uncaughtException 핸들러 누락`).toContain('uncaughtException');
      expect(content, `${svc}: unhandledRejection 핸들러 누락`).toContain('unhandledRejection');
    }
  });
});
