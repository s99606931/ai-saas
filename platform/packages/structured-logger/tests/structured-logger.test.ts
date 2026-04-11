// Structured Logger 테스트
// Design Ref: SVC-LOGGER-R29 DESIGN
// Plan SC: FR-LOG.1~FR-LOG.6

import { describe, it, expect } from 'vitest';
import { StructuredLogger, maskPiiInString } from '../src/structured-logger.js';
import type { LogEntry } from '../src/structured-logger.js';

function createTestLogger(options: ConstructorParameters<typeof StructuredLogger>[0] = {}) {
  const logs: LogEntry[] = [];
  const logger = new StructuredLogger({
    ...options,
    output: (line: string) => {
      logs.push(JSON.parse(line) as LogEntry);
    },
  });
  return { logger, logs };
}

describe('StructuredLogger', () => {
  describe('FR-LOG.1: JSON 구조화 로그', () => {
    it('JSON 형식으로 로그를 출력한다', () => {
      const { logger, logs } = createTestLogger({ level: 'debug' });

      logger.info('테스트 메시지');

      expect(logs).toHaveLength(1);
      expect(logs[0].timestamp).toBeDefined();
      expect(logs[0].level).toBe('info');
      expect(logs[0].message).toBe('테스트 메시지');
    });

    it('timestamp가 ISO 8601 형식이다', () => {
      const { logger, logs } = createTestLogger({ level: 'debug' });

      logger.info('시간 테스트');

      const isoRegex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
      expect(logs[0].timestamp).toMatch(isoRegex);
    });

    it('extra 데이터를 포함한다', () => {
      const { logger, logs } = createTestLogger({ level: 'debug' });

      logger.info('추가 데이터', { userId: 'u123', action: 'login' });

      expect(logs[0].userId).toBe('u123');
      expect(logs[0].action).toBe('login');
    });
  });

  describe('FR-LOG.2: 로그 레벨', () => {
    it('설정된 레벨 이상만 출력한다', () => {
      const { logger, logs } = createTestLogger({ level: 'warn' });

      logger.debug('무시됨');
      logger.info('무시됨');
      logger.warn('경고');
      logger.error('에러');
      logger.fatal('치명적');

      expect(logs).toHaveLength(3);
      expect(logs[0].level).toBe('warn');
      expect(logs[1].level).toBe('error');
      expect(logs[2].level).toBe('fatal');
    });

    it('debug 레벨은 모든 로그를 출력한다', () => {
      const { logger, logs } = createTestLogger({ level: 'debug' });

      logger.debug('디버그');
      logger.info('정보');
      logger.warn('경고');
      logger.error('에러');
      logger.fatal('치명적');

      expect(logs).toHaveLength(5);
    });

    it('기본 레벨은 info이다', () => {
      const { logger, logs } = createTestLogger({});

      logger.debug('무시됨');
      logger.info('출력됨');

      expect(logs).toHaveLength(1);
      expect(logs[0].level).toBe('info');
    });
  });

  describe('FR-LOG.3: 컨텍스트 바인딩', () => {
    it('service를 모든 로그에 포함한다', () => {
      const { logger, logs } = createTestLogger({
        level: 'debug',
        service: 'user-service',
      });

      logger.info('요청 처리');

      expect(logs[0].service).toBe('user-service');
    });

    it('context를 모든 로그에 포함한다', () => {
      const { logger, logs } = createTestLogger({
        level: 'debug',
        context: { tenantId: 'org-123', environment: 'production' },
      });

      logger.info('요청 처리');

      expect(logs[0].tenantId).toBe('org-123');
      expect(logs[0].environment).toBe('production');
    });
  });

  describe('FR-LOG.4: 자식 로거', () => {
    it('자식 로거가 부모 컨텍스트를 상속한다', () => {
      const { logger, logs } = createTestLogger({
        level: 'debug',
        service: 'api-gateway',
        context: { tenantId: 'org-1' },
      });

      const childLogger = logger.child({ requestId: 'req-abc' });
      childLogger.info('자식 로그');

      expect(logs[0].service).toBe('api-gateway');
      expect(logs[0].tenantId).toBe('org-1');
      expect(logs[0].requestId).toBe('req-abc');
    });

    it('자식 컨텍스트가 부모 컨텍스트를 오버라이드한다', () => {
      const { logger, logs } = createTestLogger({
        level: 'debug',
        context: { module: 'parent' },
      });

      const child = logger.child({ module: 'child' });
      child.info('오버라이드');

      expect(logs[0].module).toBe('child');
    });

    it('자식 로거가 부모 로그 레벨을 상속한다', () => {
      const { logger, logs } = createTestLogger({ level: 'error' });

      const child = logger.child({ requestId: 'req-1' });
      child.debug('무시됨');
      child.info('무시됨');
      child.error('출력됨');

      expect(logs).toHaveLength(1);
      expect(logs[0].level).toBe('error');
    });
  });

  describe('FR-LOG.5: PII 마스킹', () => {
    it('이메일을 마스킹한다', () => {
      expect(maskPiiInString('user@example.com')).toBe('u***@e***.com');
    });

    it('전화번호를 마스킹한다', () => {
      expect(maskPiiInString('010-1234-5678')).toBe('010-****-5678');
    });

    it('IP 주소를 마스킹한다', () => {
      expect(maskPiiInString('192.168.1.100')).toBe('192.168.*.*');
    });

    it('로그 메시지 내 PII를 자동 마스킹한다', () => {
      const { logger, logs } = createTestLogger({
        level: 'debug',
        maskPii: true,
      });

      logger.info('로그인', { email: 'admin@gov.kr', ip: '10.0.0.1' });

      expect(logs[0].email).toBe('a***@g***.kr');
      expect(logs[0].ip).toBe('10.0.*.*');
    });

    it('maskPii: false로 비활성화할 수 있다', () => {
      const { logger, logs } = createTestLogger({
        level: 'debug',
        maskPii: false,
      });

      logger.info('로그인', { email: 'admin@gov.kr' });

      expect(logs[0].email).toBe('admin@gov.kr');
    });
  });

  describe('FR-LOG.6: 성능 타이머', () => {
    it('경과 시간을 밀리초로 반환한다', async () => {
      const { logger } = createTestLogger({ level: 'debug' });

      const stop = logger.startTimer();
      // 최소 대기
      await new Promise((resolve) => setTimeout(resolve, 50));
      const elapsed = stop();

      expect(elapsed).toBeGreaterThanOrEqual(40);
      expect(elapsed).toBeLessThan(500);
    });

    it('여러 타이머를 독립적으로 사용할 수 있다', () => {
      const { logger } = createTestLogger({ level: 'debug' });

      const stop1 = logger.startTimer();
      const stop2 = logger.startTimer();

      const elapsed1 = stop1();
      const elapsed2 = stop2();

      expect(typeof elapsed1).toBe('number');
      expect(typeof elapsed2).toBe('number');
    });
  });
});
